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

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("Server running on port 8000");
});

app.use(
  cors({
    origin: "http://localhost:3000", // frontend Next.js
    credentials: true,
  })
);

app.use("/users", authRoutes);
app.use("/users", userRoutes);
app.use("/customers", customerRoutes);
app.use("/sellers", sellerRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/orders/:orderId/items", orderItemRoutes);
app.use("/payment", paymentRoutes);
app.use("/review", reviewRoutes);
app.use("/dashboard", dashboardRoutes);

// Encerrar conexão do Prisma quando o servidor for interrompido
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Prisma disconnected.");
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
