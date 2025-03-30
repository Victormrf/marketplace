import express from "express";
import { userRoutes } from "./controllers/userController";
import { authRoutes } from "./controllers/authController";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.send("Server running on port 8000");
});

app.use("/login", authRoutes);
app.use("/users", userRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
