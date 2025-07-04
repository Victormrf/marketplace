"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./config/db"));
const userController_1 = require("./controllers/userController");
const authController_1 = require("./controllers/authController");
const customerController_1 = require("./controllers/customerController");
const sellerController_1 = require("./controllers/sellerController");
const productController_1 = require("./controllers/productController");
const orderController_1 = require("./controllers/orderController");
const orderItemController_1 = require("./controllers/orderItemController");
const paymentController_1 = require("./controllers/paymentController");
const reviewController_1 = require("./controllers/reviewController");
const dashboardController_1 = require("./controllers/dashboardController");
const cors_1 = __importDefault(require("cors"));
const cartItemController_1 = require("./controllers/cartItemController");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const deliveryController_1 = require("./controllers/deliveryController");
const refundController_1 = require("./controllers/refundController");
const node_cron_1 = __importDefault(require("node-cron"));
const deliveryStatusUpdater_1 = require("./jobs/deliveryStatusUpdater");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = process.env.PORT || 8000;
app.get("/", (req, res) => {
    res.send("Server running on port 8000");
});
app.use((0, cors_1.default)({
    origin: "http://localhost:3000", // frontend Next.js
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use("/users", authController_1.authRoutes);
app.use("/users", userController_1.userRoutes);
app.use("/customers", customerController_1.customerRoutes);
app.use("/sellers", sellerController_1.sellerRoutes);
app.use("/cart-items", cartItemController_1.cartItemRoutes);
app.use("/products", productController_1.productRoutes);
app.use("/orders", orderController_1.orderRoutes);
app.use("/orders/:orderId/items", orderItemController_1.orderItemRoutes);
app.use("/payment", paymentController_1.paymentRoutes);
app.use("/review", reviewController_1.reviewRoutes);
app.use("/dashboard", dashboardController_1.dashboardRoutes);
app.use("/delivery", deliveryController_1.deliveryRoutes);
app.use("/refund", refundController_1.refundRoutes);
// Encerrar conexão do Prisma quando o servidor for interrompido
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    yield db_1.default.$disconnect();
    console.log("Prisma disconnected.");
    process.exit(0);
}));
// Rodar a cada 1 hora
node_cron_1.default.schedule("0 * * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Starting automatic status update...");
    yield (0, deliveryStatusUpdater_1.updateDeliveryStatuses)();
}));
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
