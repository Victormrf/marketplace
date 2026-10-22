const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const TARGET = Object.freeze({
  container: "marketplace-scale-postgres",
  volume: "marketplace_scale_data",
  database: "marketplace_scale",
  user: "marketplace_scale",
  port: "5435",
  environment: "marketplace-scale-v1",
  confirmation: "marketplace_scale@127.0.0.1:5435",
});
const DEFAULT_URL =
  "postgresql://marketplace_scale:scale_local_only@127.0.0.1:5435/marketplace_scale";
const GIB = 1024 ** 3;

function assertTarget(rawUrl) {
  const url = new URL(rawUrl);

  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== TARGET.port ||
    url.pathname !== `/${TARGET.database}` ||
    url.username !== TARGET.user ||
    url.password !== "scale_local_only" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Unauthorized scale destination; refusing connection");
  }

  return rawUrl;
}

function assertConfirmation(value) {
  if (value !== TARGET.confirmation) {
    throw new Error(`Explicit --confirm ${TARGET.confirmation} is required`);
  }
}

function assertProfileApproval(profile, approval, smallMeasured) {
  if (!["small", "medium", "large"].includes(profile)) {
    throw new Error("Unknown profile");
  }

  if (profile !== "small" && (approval !== profile || !smallMeasured)) {
    throw new Error(
      "Non-small loads require prior small measurement and explicit profile approval",
    );
  }
}

function command(file, args) {
  return execFileSync(file, args, {
    encoding: "utf8",
    timeout: 25000,
    maxBuffer: 512 * 1024,
    windowsHide: true,
  }).trim();
}

function inspectContainer() {
  const info = JSON.parse(
    command("docker", ["inspect", "--size", TARGET.container]),
  )[0];
  const mount = info.Mounts.find(
    (entry) => entry.Destination === "/var/lib/postgresql/data",
  );
  const binding = info.HostConfig.PortBindings["5432/tcp"];

  if (
    info.Config.Labels["com.marketplace.environment"] !== "scale-v1" ||
    !mount ||
    mount.Type !== "volume" ||
    mount.Name !== TARGET.volume ||
    binding?.length !== 1 ||
    binding[0].HostIp !== "127.0.0.1" ||
    binding[0].HostPort !== TARGET.port ||
    !info.State.Running ||
    info.HostConfig.LogConfig.Type !== "json-file" ||
    info.HostConfig.LogConfig.Config["max-size"] !== "10m" ||
    info.HostConfig.LogConfig.Config["max-file"] !== "3"
  ) {
    throw new Error(
      "Container identity, dedicated volume or port binding mismatch",
    );
  }

  const volume = JSON.parse(
    command("docker", ["volume", "inspect", TARGET.volume]),
  )[0];

  if (volume.Labels?.["com.marketplace.environment"] !== "scale-v1") {
    throw new Error("Scale volume has an unauthorized identity");
  }

  return {
    container: TARGET.container,
    volume: mount.Name,
    internalDataPath: "/var/lib/postgresql/data/pgdata",
    volumePathInsideDocker: volume.Mountpoint,
    writableLayerBytes: Number(info.SizeRw),
    boundedLogBytes: 30 * 1024 ** 2,
  };
}

function hostStorage() {
  const settings = JSON.parse(
    fs.readFileSync(
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Docker",
        "settings-store.json",
      ),
      "utf8",
    ),
  );
  const root = settings.CustomWslDistroDir;

  if (!root || settings.WslEngineEnabled !== true) {
    throw new Error("Cannot identify the Docker Desktop WSL data disk");
  }

  const candidates = [
    path.join(root, "disk", "docker_data.vhdx"),
    path.join(root, "data", "ext4.vhdx"),
  ].filter((candidate) => fs.existsSync(candidate));

  if (candidates.length !== 1) {
    throw new Error("Cannot uniquely identify Docker's shared data VHDX");
  }

  const vhdx = candidates[0];
  const drive = path.parse(vhdx).root;

  if (!/^[A-Za-z]:\\$/.test(drive)) {
    throw new Error("Windows data drive could not be identified");
  }

  const free = Number(
    command("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `[System.IO.DriveInfo]::new('${drive}').AvailableFreeSpace`,
    ]),
  );

  if (!Number.isFinite(free) || free <= 0) {
    throw new Error("Physical Windows free space is unavailable");
  }

  return {
    windowsDrive: drive,
    windowsFreeBytes: free,
    sharedVhdx: vhdx,
    sharedVhdxFileLengthBytes: fs.statSync(vhdx).size,
    limitation:
      "Shared VHDX logical file length, not scale-only allocated space; volume has no separate Windows folder",
  };
}

async function measureStorage(db) {
  const container = inspectContainer();
  const sizes = command("docker", [
    "exec",
    TARGET.container,
    "sh",
    "-c",
    "du -sk /var/lib/postgresql/data; du -sk /var/lib/postgresql/data/pgdata/pg_wal",
  ])
    .split(/\r?\n/)
    .map((line) => Number(line.split(/\s+/)[0]) * 1024);
  const [database] = await db.$queryRaw`
    SELECT pg_database_size(current_database()) AS bytes
  `;

  return {
    measuredAt: new Date().toISOString(),
    ...container,
    ...hostStorage(),
    databaseBytes: Number(database.bytes),
    postgresDirectoryBytes: sizes[0],
    walDirectoryBytes: sizes[1],
  };
}

function assertBudget(
  measurement,
  policy,
  limits,
  inserted,
  nextRows,
  elapsedMs,
) {
  for (const key of [
    "databaseBytes",
    "postgresDirectoryBytes",
    "walDirectoryBytes",
    "windowsFreeBytes",
    "writableLayerBytes",
    "boundedLogBytes",
  ]) {
    if (!Number.isFinite(measurement[key]) || measurement[key] < 0) {
      throw new Error(`Indispensable measurement missing: ${key}`);
    }
  }

  const margin = 128 * 1024 ** 2 + nextRows * 64 * 1024;
  const occupied =
    Math.max(measurement.databaseBytes, measurement.postgresDirectoryBytes) +
    measurement.writableLayerBytes +
    measurement.boundedLogBytes;

  if (
    occupied + margin >= policy.targetStorageBytes ||
    occupied + margin >= policy.hardStorageLimitBytes ||
    measurement.windowsFreeBytes < 2 * GIB + margin ||
    inserted + nextRows > limits.maxRecords ||
    elapsedMs + 5000 >= Math.min(policy.maxDurationMs, limits.maxDurationMs)
  ) {
    throw new Error(
      "Preventive record/time/storage/Windows-space limit reached",
    );
  }
}

module.exports = {
  TARGET,
  DEFAULT_URL,
  assertTarget,
  assertConfirmation,
  assertProfileApproval,
  command,
  inspectContainer,
  hostStorage,
  measureStorage,
  assertBudget,
};
