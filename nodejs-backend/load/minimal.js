const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { performance } = require("node:perf_hooks");
const { cpuClock, assertMemory } = require("./supervisor");
const { assertBudget } = require("../scripts/scale/environment");
const { config } = require("../scripts/scale/planner");

function recordMemory(environment, phase) {
  if (
    !["scale", "fixture-test"].includes(environment) ||
    !["stopped", "postgres", "api"].includes(phase)
  ) {
    throw new Error("Unknown minimal memory phase");
  }
  const directory = path.join(__dirname, ".local");
  const filename = path.join(directory, `minimal-memory-${environment}.json`);
  fs.mkdirSync(directory, { recursive: true });
  const data =
    phase === "stopped" || !fs.existsSync(filename)
      ? {}
      : JSON.parse(fs.readFileSync(filename));
  data[phase] = { at: new Date().toISOString(), availableBytes: os.freemem() };
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  return data;
}

// No Docker/PowerShell subprocess, SQL or process attribution in a live sample.
function collector(baseline, policy, detailed) {
  return {
    close: async () => {},
    async detailed() {
      const started = performance.now();
      const storage = await detailed();
      assertBudget(
        storage,
        config.executionPolicy,
        config.profiles.small.limits,
        0,
        500,
        0,
      );
      return {
        at: Date.now(),
        collectionMs: performance.now() - started,
        storage,
      };
    },
    async sample() {
      const started = performance.now();
      const disk = fs.statfsSync(baseline.windowsDrive);
      const storage = {
        ...baseline,
        windowsFreeBytes: disk.bavail * disk.bsize,
      };
      assertBudget(
        storage,
        config.executionPolicy,
        config.profiles.small.limits,
        0,
        500,
        0,
      );
      const freeMemoryBytes = os.freemem();
      if (freeMemoryBytes < policy.minimumAvailableMemoryBytes) {
        throw Object.assign(
          new Error("Emergency 512 MiB floor reached; stop without retry"),
          { freeMemoryBytes },
        );
      }
      return {
        at: Date.now(),
        freeMemoryBytes,
        clock: cpuClock(),
        storage,
        collectionMs: performance.now() - started,
      };
    },
  };
}

function watch(child, initial, gather, interval, readMemory, policy) {
  assertMemory(initial.freeMemoryBytes, policy);
  const report = {
    kind: "minimal-host-safety",
    samples: 1,
    memorySamples: 1,
    minHostFreeBytes: initial.freeMemoryBytes,
    maxHostCpuPercent: null,
    maxHighCpuDurationMs: null,
    maxCollectionMs: initial.collectionMs,
    timestamps: [{ at: initial.at, collectionMs: initial.collectionMs }],
    minWindowsFreeBytes: initial.storage.windowsFreeBytes,
    limitation:
      "Host samples only; short runs do not establish process peaks or query history",
  };
  return new Promise((resolve, reject) => {
    let previous = initial;
    let highSince;
    let finished = false;
    let sampling = false;
    const finish = (error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearInterval(timer);
      child.off("exit", exited);
      if (error) {
        if (Number.isFinite(error.freeMemoryBytes)) {
          report.minHostFreeBytes = Math.min(
            report.minHostFreeBytes,
            error.freeMemoryBytes,
          );
        }
        child.kill("SIGINT");
        error.resourceSummary = report;
        reject(error);
      } else {
        resolve(report);
      }
    };
    const exited = (code) =>
      finish(
        code === 0
          ? null
          : new Error("Minimal operation interrupted; reconcile without retry"),
      );
    const timer = setInterval(async () => {
      if (finished || sampling) {
        return;
      }
      sampling = true;
      try {
        const current = await gather();
        if (finished) {
          return;
        }
        report.samples += 1;
        report.memorySamples += 1;
        report.minHostFreeBytes = Math.min(
          report.minHostFreeBytes,
          current.freeMemoryBytes,
        );
        if (current.freeMemoryBytes < policy.minimumAvailableMemoryBytes) {
          throw Object.assign(new Error("Emergency memory floor reached"), {
            freeMemoryBytes: current.freeMemoryBytes,
          });
        }
        report.minWindowsFreeBytes = Math.min(
          report.minWindowsFreeBytes,
          current.storage.windowsFreeBytes,
        );
        report.maxCollectionMs = Math.max(
          report.maxCollectionMs,
          current.collectionMs,
        );
        const total = current.clock.total - previous.clock.total;
        const idle = current.clock.idle - previous.clock.idle;
        if (total <= 0 || idle < 0 || idle > total) {
          throw new Error("Host CPU measurement unavailable");
        }
        const cpu = 100 * (1 - idle / total);
        report.maxHostCpuPercent = Math.max(report.maxHostCpuPercent ?? 0, cpu);
        highSince =
          cpu > policy.hostCpuPercent ? (highSince ?? previous.at) : undefined;
        const sustained = highSince === undefined ? 0 : current.at - highSince;
        report.maxHighCpuDurationMs = Math.max(
          report.maxHighCpuDurationMs ?? 0,
          sustained,
        );
        if (report.timestamps.length === 64) {
          report.timestamps.shift();
        }
        report.timestamps.push({
          at: current.at,
          collectionMs: current.collectionMs,
          cpu,
        });
        if (sustained >= policy.cpuSustainedSeconds * 1000) {
          throw new Error("Sustained host CPU limit reached");
        }
        previous = current;
      } catch (error) {
        finish(error);
      } finally {
        sampling = false;
      }
    }, 100);
    child.once("exit", exited);
  });
}

if (require.main === module) {
  console.log(
    JSON.stringify(recordMemory(process.argv[2], process.argv[3]), null, 2),
  );
}
module.exports = { collector, watch, recordMemory };
