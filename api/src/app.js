import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import serverRoutes from "./routes/serverRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/server", serverRoutes);

app.get("/health", function handleHealth(_req, res) {
    res.json({ status: "ok" });
});

const port = process.env.PORT || 4000;

app.listen(port, function startServer() {
    console.log("API REST démarrée sur le port", port);
});
