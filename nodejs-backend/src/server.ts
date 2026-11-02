import { catalogTracing, stopTracing } from "./observability/tracing";
import express from "express";
import type { Server } from "node:http";
import prisma from "./config/db";
import path from "path";
import { userRoutes } from "./controllers/userController";
import { authRoutes } from "./controllers/authController";
import { customerRoutes } from "./controllers/customerController";
import { sellerRoutes } from "./controllers/sellerController";
import { productRoutes } from "./controllers/productController";
import { orderRoutes, sellerOrderRoutes } from "./controllers/orderController";
import { paymentRoutes } from "./controllers/paymentController";
import { reviewRoutes } from "./controllers/reviewController";
import { dashboardRoutes } from "./controllers/dashboardController";
import cors from "cors";
import { cartRoutes } from "./controllers/cartController";
import cookieParser from "cookie-parser";
import { deliveryRoutes } from "./controllers/deliveryController";
import { inventoryRoutes } from "./controllers/inventoryController";
import { customerAddressRoutes } from "./controllers/customerAddressController";
import { checkoutRoutes } from "./controllers/checkoutController";
import { refundRoutes } from "./controllers/refundController";
import { requestLogging } from "./middlewares/requestLogging";
import { logger } from "./utils/logger";
import { metrics, metricsHandler } from "./observability/metrics";
import {
  createPostgresCollector,
  readPostgresSnapshot,
} from "./observability/postgresMetrics";

import { liveness, readiness, checkDatabase } from "./observability/health";

const app = express();
app.use(catalogTracing);
app.use(requestLogging());
if (metrics.enabled) {
  app.get("/metrics", metricsHandler());
}
app.get("/health/live", liveness);
app.get(
  "/health/ready",
  readiness(() => checkDatabase(prisma)),
);
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("Server running on port 8000");
});

if (process.env.NODE_ENV !== "production") {
  const docsDirectory = path.resolve(__dirname, "../docs");

  app.get("/docs", (_req, res) => {
    res.sendFile(path.join(docsDirectory, "index.html"));
  });

  app.get("/docs/", (_req, res) => {
    res.sendFile(path.join(docsDirectory, "index.html"));
  });

  app.get("/docs/openapi.yaml", (_req, res) => {
    res.type("application/yaml; charset=utf-8");
    res.sendFile(path.join(docsDirectory, "openapi.yaml"));
  });
}

app.use(
  cors({
    origin: ["http://localhost:3000", "https://v-market-one.vercel.app"], // frontend Next.js
    credentials: true,
  }),
);

app.use(cookieParser());

app.use("/users", authRoutes);
app.use("/users", userRoutes);
app.use("/customers/addresses", customerAddressRoutes);
app.use("/customers", customerRoutes);
app.use("/sellers", sellerRoutes);
app.use("/cart", cartRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/seller-orders", sellerOrderRoutes);
app.use("/", paymentRoutes);
app.use("/", refundRoutes);
app.use("/", reviewRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/", deliveryRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/checkout", checkoutRoutes);

const postgresCollector = createPostgresCollector(() =>
  readPostgresSnapshot(prisma),
);
let httpServer: Server | undefined;
let shuttingDown = false;

// Stop collection before closing Prisma; importing app does not start a poller.
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (httpServer) {
    const server = httpServer;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
  }
  await postgresCollector.stop();
  await stopTracing();
  await prisma.$disconnect();
  logger.info("server.stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (require.main === module) {
  httpServer = app.listen(PORT, () => {
    postgresCollector.start();
    logger.info("server.started", { port: Number(PORT) });
  });
}

export { app };
