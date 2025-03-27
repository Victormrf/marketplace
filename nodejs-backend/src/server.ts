import express from "express";
import { userRoutes } from "./controllers/userController";

const app = express();
app.use(express.json());

const PORT = 8000;

app.get("/", (req, res) => {
  res.send("Server running on port 8000");
});

app.use("/users", userRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
