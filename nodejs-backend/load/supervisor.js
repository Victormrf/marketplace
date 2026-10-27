const os = require("node:os");
const { command, assertBudget } = require("../scripts/scale/environment");
const { config } = require("../scripts/scale/planner");
const plan = require("./plan.json");

function cpuClock() {
  return os.cpus().reduce(
    (sum, cpu) => {
      sum.idle += cpu.times.idle;
      sum.total += Object.values(cpu.times).reduce(
        (total, value) => total + value,
        0,
      );
      return sum;
    },
    { idle: 0, total: 0 },
  );
}

function memoryBytes(raw) {
  const match = /^([\d.]+)\s*(B|KiB|MiB|GiB|TiB|kB|MB|GB)$/.exec(raw.trim());
  const factors = {
    B: 1,
    KiB: 1024,
    MiB: 1024 ** 2,
    GiB: 1024 ** 3,
    TiB: 1024 ** 4,
    kB: 1000,
    MB: 1e6,
    GB: 1e9,
  };
  if (!match) {
    throw new Error("Unrecognized Docker memory measurement");
  }
  return Number(match[1]) * factors[match[2]];
}

function processSample(pid) {
  if (!Number.isInteger(pid) || pid < 1) {
    throw new Error("Missing dedicated API PID");
  }
  return JSON.parse(
    command("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$p=Get-Process -Id ${pid} -ErrorAction Stop; [pscustomobject]@{pid=$p.Id;cpuMs=$p.TotalProcessorTime.TotalMilliseconds;workingSetBytes=$p.WorkingSet64;privateBytes=$p.PrivateMemorySize64;startedAt=$p.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress`,
    ]),
  );
}

function evaluate(current, previous, state, policy = plan.stopPolicy) {
  for (const number of [
    current.at,
    current.freeMemoryBytes,
    current.process.cpuMs,
    current.process.workingSetBytes,
    current.postgresCpuCorePercent,
    current.postgresMemoryBytes,
    current.activity.connections,
    current.activity.active,
    current.activity.waiting,
    current.activity.maxLockSeconds,
    current.clock.idle,
    current.clock.total,
  ]) {
    if (!Number.isFinite(number) || number < 0) {
      throw new Error("Indispensable resource measurement unavailable");
    }
  }
  assertBudget(
    current.storage,
    config.executionPolicy,
    config.profiles.small.limits,
    0,
    500,
    0,
  );
  if (current.freeMemoryBytes < policy.minimumAvailableMemoryBytes) {
    throw new Error(
      `Host memory below ${policy.minimumAvailableMemoryBytes} bytes; execution interrupted`,
    );
  }
  if (
    current.activity.connections > policy.maximumDbConnections ||
    current.activity.maxLockSeconds > policy.lockWaitSeconds
  ) {
    throw new Error("PostgreSQL connection/lock safety limit exceeded");
  }
  const total = previous ? current.clock.total - previous.clock.total : 0;
  const idle = previous ? current.clock.idle - previous.clock.idle : 0;
  const elapsed = previous ? current.at - previous.at : 0;
  if (
    previous &&
    (total <= 0 ||
      idle < 0 ||
      idle > total ||
      elapsed <= 0 ||
      current.process.cpuMs < previous.process.cpuMs)
  ) {
    throw new Error("Resource clocks did not advance consistently");
  }
  const hostCpuPercent = total > 0 ? 100 * (1 - idle / total) : null;
  const apiCpuCorePercent =
    elapsed > 0
      ? (100 * (current.process.cpuMs - previous.process.cpuMs)) / elapsed
      : null;
  if (hostCpuPercent !== null && hostCpuPercent > policy.hostCpuPercent) {
    state.highCpuSince ??= previous.at;
    if (current.at - state.highCpuSince >= policy.cpuSustainedSeconds * 1000) {
      throw new Error("Sustained host CPU safety limit exceeded");
    }
  } else {
    state.highCpuSince = null;
  }
  return {
    hostCpuPercent,
    apiCpuCorePercent,
    highCpuDurationMs:
      state.highCpuSince == null ? 0 : current.at - state.highCpuSince,
  };
}

function aggregate() {
  return {
    samples: 0,
    minHostFreeBytes: null,
    minWindowsFreeBytes: null,
    maxHostCpuPercent: 0,
    maxHighCpuDurationMs: 0,
    maxApiCpuCorePercent: 0,
    maxApiWorkingSetBytes: 0,
    maxApiPrivateBytes: null,
    maxApiHeapUsedBytes: 0,
    maxPostgresCpuCorePercent: 0,
    maxPostgresMemoryBytes: 0,
    maxConnections: 0,
    maxActiveSessions: 0,
    maxWaitingSessions: 0,
    maxLockSeconds: 0,
    maxDatabaseBytes: 0,
    maxPostgresDirectoryBytes: 0,
    slowObservations: 0,
    slowFingerprints: [],
    maxCollectionMs: 0,
    timestamps: [],
    totalCollectionMs: 0,
  };
}

function accumulate(result, current, cpu) {
  result.storageBefore ??= current.storage;
  result.storageAfter = current.storage;
  result.samples += 1;
  result.minHostFreeBytes = Math.min(
    result.minHostFreeBytes ?? Infinity,
    current.freeMemoryBytes,
  );
  result.minWindowsFreeBytes = Math.min(
    result.minWindowsFreeBytes ?? Infinity,
    current.storage.windowsFreeBytes,
  );
  const values = {
    maxHostCpuPercent: cpu.hostCpuPercent || 0,
    maxHighCpuDurationMs: cpu.highCpuDurationMs || 0,
    maxApiCpuCorePercent: cpu.apiCpuCorePercent || 0,
    maxApiWorkingSetBytes: current.process.workingSetBytes,
    maxApiHeapUsedBytes: current.process.heapUsedBytes || 0,
    maxPostgresCpuCorePercent: current.postgresCpuCorePercent,
    maxPostgresMemoryBytes: current.postgresMemoryBytes,
    maxConnections: current.activity.connections,
    maxActiveSessions: current.activity.active,
    maxWaitingSessions: current.activity.waiting,
    maxLockSeconds: current.activity.maxLockSeconds,
    maxDatabaseBytes: current.storage.databaseBytes,
    maxPostgresDirectoryBytes: current.storage.postgresDirectoryBytes,
    maxCollectionMs: current.collectionMs || 0,
  };
  if (
    current.process.privateBytes !== undefined &&
    current.process.privateBytes !== null
  ) {
    values.maxApiPrivateBytes = current.process.privateBytes;
  }
  for (const [key, value] of Object.entries(values)) {
    result[key] = Math.max(result[key], value);
  }
  result.slowObservations += current.slow.length;
  result.totalCollectionMs += current.collectionMs || 0;
  if (result.timestamps.length < 64) {
    result.timestamps.push({
      at: current.at,
      collectionMs: current.collectionMs,
      sources: current.sourceTimes,
    });
  }
  for (const observation of current.slow) {
    if (
      !result.slowFingerprints.includes(observation.fingerprint) &&
      result.slowFingerprints.length < 20
    ) {
      result.slowFingerprints.push(observation.fingerprint);
    }
  }
}

function assertMemory(freeBytes = os.freemem(), policy = plan.stopPolicy) {
  if (
    !Number.isFinite(freeBytes) ||
    freeBytes < policy.minimumStartAvailableMemoryBytes
  ) {
    throw new Error(
      `Host memory below ${policy.minimumStartAvailableMemoryBytes} bytes or unavailable; no API/load will be started`,
    );
  }
}

async function environmentMetadata(db) {
  const info = JSON.parse(
    command("docker", ["info", "--format", "{{json .}}"]),
  );
  const [container] = JSON.parse(
    command("docker", ["inspect", "marketplace-scale-postgres"]),
  );
  const [version] = await db.$queryRaw`SELECT version() AS postgres`;
  const settings = await db.$queryRaw`SELECT name,setting,unit FROM pg_settings
    WHERE name IN ('shared_buffers','work_mem','max_connections','log_min_duration_statement','shared_preload_libraries') ORDER BY name`;
  if (
    !Number.isFinite(info.NCPU) ||
    info.NCPU < 1 ||
    !Number.isFinite(info.MemTotal) ||
    info.MemTotal < 1
  ) {
    throw new Error("Docker VM CPU/memory metadata unavailable");
  }
  return {
    engine: info.ServerVersion,
    vmConfiguredCpuCount: info.NCPU,
    vmConfiguredMemoryBytes: info.MemTotal,
    container: {
      image: container.Config.Image,
      memoryLimitBytes: container.HostConfig.Memory,
      nanoCpus: container.HostConfig.NanoCpus,
      cpuQuota: container.HostConfig.CpuQuota,
      cpuPeriod: container.HostConfig.CpuPeriod,
    },
    postgres: version.postgres,
    settings,
    limitation:
      "VM configured resources, not continuously sampled VM-wide consumption; zero container limits mean no explicit cap. Slow sessions are sampled, not a complete query history.",
  };
}

module.exports = {
  cpuClock,
  evaluate,
  aggregate,
  accumulate,
  memoryBytes,
  processSample,
  assertMemory,
  environmentMetadata,
};
