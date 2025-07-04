import express from "express";
import prisma from "./config/db";
import { userRoutes } from "./controllers/userController";
import { authRoutes } from "./controllers/authController";
import { customerRoutes } from "./controllers/customerController";
import { sellerRoutes } from "./controllers/sellerController";
import { productRoutes } from "./controllers/productController";
import { orderRoutes } from "./controllers/orderController";
import { orderItemRoutes } from "./controllers/orderItemController";
import { paymentRoutes } from "./controllers/paymentController";
import { reviewRoutes } from "./controllers/reviewController";
import { dashboardRoutes } from "./controllers/dashboardController";
import cors from "cors";
import { cartItemRoutes } from "./controllers/cartItemController";
import cookieParser from "cookie-parser";
import { deliveryRoutes } from "./controllers/deliveryController";
import { refundRoutes } from "./controllers/refundController";
import cron from "node-cron";
import { updateDeliveryStatuses } from "./jobs/deliveryStatusUpdater";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("Server running on port 8000");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV, db: process.env.DATABASE_URL ? "set" : "not set" });
});

app.use(
  cors({
    origin: "http://localhost:3000", // frontend Next.js
    credentials: true,
  })
);

app.use(cookieParser());

app.use("/users", authRoutes);
app.use("/users", userRoutes);
app.use("/customers", customerRoutes);
app.use("/sellers", sellerRoutes);
app.use("/cart-items", cartItemRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/orders/:orderId/items", orderItemRoutes);
app.use("/payment", paymentRoutes);
app.use("/review", reviewRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/delivery", deliveryRoutes);
app.use("/refund", refundRoutes);

// Encerrar conexão do Prisma quando o servidor for interrompido
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Prisma disconnected.");
  process.exit(0);
});

// Rodar a cada 1 hora
cron.schedule("0 * * * *", async () => {
  console.log("Starting automatic status update...");
  await updateDeliveryStatuses();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
