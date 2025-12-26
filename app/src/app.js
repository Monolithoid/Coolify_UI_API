import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serverRoutes from "./routes/serverRoutes.js";
import gamesRoutes from "./routes/gamesRoutes.js";
import discordRoutes from "./routes/discordRoutes.js";
import { startDiscordIntegration } from "./services/discordBotService.js";

dotenv.config();

const app = express();

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const webAppDirectory = resolveWebAppDirectory(currentDirectory);

serveMiddlewares(app, webAppDirectory);
registerRoutes(app);
startDiscordIntegration();

app.get("/health", function handleHealth(_req, res) {
    res.json({ status: "ok" });
});

const port = process.env.PORT || 80;

app.listen(port, function startServer() {
    console.log("REST API started on port", port);
});

/**
 * Configure shared middleware and the static page served by the application.
 * Adds CORS, JSON parsing, and the web app index route.
 */
function serveMiddlewares(expressApp, staticDirectory) {
    expressApp.use(cors());
    expressApp.use(express.json());
    expressApp.use(express.static(staticDirectory));

    expressApp.get("/", function sendHome(_req, res) {
        res.sendFile(path.join(staticDirectory, "index.html"));
    });
}

/**
 * Register the API routes grouped by functional area.
 */
function registerRoutes(expressApp) {
    expressApp.use("/api/server", serverRoutes);
    expressApp.use("/api/games", gamesRoutes);
    expressApp.use("/api/discord", discordRoutes);
}

/**
 * Determine the directory that contains the static web application to serve.
 * Allows overriding the path with the WEB_APP_PATH environment variable.
 */
function resolveWebAppDirectory(baseDirectory) {
    const overridePath = process.env.WEB_APP_PATH;

    if (overridePath && fs.existsSync(overridePath)) {
        return overridePath;
    }

    const candidates = [
        path.join(baseDirectory, "..", "web-app")
    ];

    const existingPath = candidates.find(function findExisting(candidate) {
        return fs.existsSync(candidate);
    });

    if (existingPath) {
        return existingPath;
    }

    return path.join(baseDirectory, "..", "web-app");
}
