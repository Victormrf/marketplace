import express from "express";
import prisma from "./config/db";
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
import cron from "node-cron";
import { updateDeliveryStatuses } from "./jobs/deliveryStatusUpdater";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("Server running on port 8000");
});

// app.get("/health", (req, res) => {
//   res.json({ status: "ok", env: process.env.NODE_ENV, db: process.env.DATABASE_URL ? "set" : "not set" });
// });

app.use(
  cors({
    origin: ["http://localhost:3000", "https://v-market-one.vercel.app"], // frontend Next.js
    credentials: true,
  })
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
app.use("/review", reviewRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/delivery", deliveryRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/checkout", checkoutRoutes);

// Encerrar conexão do Prisma quando o servidor for interrompido
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Prisma disconnected.");
  process.exit(0);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  // Scheduled jobs belong to the executable server, not to imported test app instances.
  cron.schedule("0 * * * *", async () => {
    console.log("Starting automatic status update...");
    await updateDeliveryStatuses();
  });
}

export { app };
