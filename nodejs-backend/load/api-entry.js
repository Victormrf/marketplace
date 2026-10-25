const { app } = require("../dist/server");

const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
let timer;

function metrics() {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    pid: process.pid,
    startedAt,
    at: Date.now(),
    cpuMs: (cpu.user + cpu.system) / 1000,
    workingSetBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
  };
}

const server = app.listen(8051, "127.0.0.1", () => {
  process.send?.({ type: "ready", metrics: metrics() });
  timer = setInterval(
    () => process.send?.({ type: "metrics", metrics: metrics() }),
    1000,
  );
  timer.unref();
});

server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
process.on("disconnect", () => {
  clearInterval(timer);
  server.close(() => process.exit(0));
});
