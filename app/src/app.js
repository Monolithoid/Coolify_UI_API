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
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import { requireAuth } from "./services/authMiddleware.js";
import { ensurePersistentFiles } from "./services/persistentFiles.js";

dotenv.config();

const app = express();

ensurePersistentFiles();

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const webAppEnabled = isWebAppEnabled();
const webAppDirectory = resolveWebAppDirectory(currentDirectory, webAppEnabled);
const dataDirectory = resolveDataDirectory(
    currentDirectory,
    process.env.ALLOWED_EMAILS_FILE,
    process.env.GAME_PRESETS_FILE
);
const iconPath = path.join(dataDirectory, "Icon.png");

serveMiddlewares(app, webAppDirectory, webAppEnabled, iconPath);
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
function serveMiddlewares(expressApp, staticDirectory, webAppEnabled, faviconPath) {
    expressApp.use(cors({ origin: true, credentials: true }));
    expressApp.use(cookieParser());
    expressApp.use(express.json());

    addIconRoutes(expressApp, faviconPath);

    if (webAppEnabled) {
        expressApp.use(express.static(staticDirectory));

        expressApp.get("/", function sendHome(_req, res) {
            res.sendFile(path.join(staticDirectory, "index.html"));
        });
    }
}

/**
 * Register the API routes grouped by functional area.
 */
function registerRoutes(expressApp) {
    expressApp.use("/api/auth", authRoutes);
    expressApp.use("/api/server", requireAuth, serverRoutes);
    expressApp.use("/api/games", requireAuth, gamesRoutes);
    expressApp.use("/api/discord", requireAuth, discordRoutes);
}

/**
 * Serve the Coolify icon directly from the persistent data directory so it
 * remains in sync with the configured Icon.png asset and is available for
 * both favicon and inline image usage.
 */
function addIconRoutes(expressApp, faviconPath) {
    if (!fs.existsSync(faviconPath)) {
        return;
    }

    expressApp.get("/favicon.ico", function sendFavicon(_req, res) {
        res.sendFile(faviconPath);
    });

    expressApp.get("/Icon.png", function sendIconPng(_req, res) {
        res.sendFile(faviconPath);
    });
}

/**
 * Determine the directory that contains the static web application to serve.
 * Allows overriding the path with the WEB_APP_PATH environment variable.
 */
function resolveWebAppDirectory(baseDirectory, webAppEnabled) {
    if (!webAppEnabled) {
        return "";
    }

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

/**
 * Resolve the directory that contains persistent configuration files so the
 * shared Icon.png is served from the same location as the presets and the
 * allowlist.
 */
function resolveDataDirectory(baseDirectory, allowedEmailsFile, gamePresetsFile) {
    const candidates = [];

    const allowedEmailsDirectory = extractDirectory(allowedEmailsFile);

    if (allowedEmailsDirectory) {
        candidates.push(allowedEmailsDirectory);
    }

    const gamePresetsDirectory = extractDirectory(gamePresetsFile);

    if (gamePresetsDirectory) {
        candidates.push(gamePresetsDirectory);
    }

    const defaultDirectory = path.join(baseDirectory, "..", "..", "data");

    candidates.push(defaultDirectory);

    const directoryWithIcon = candidates.find(function pickDirectory(directory) {
        const iconCandidate = path.join(directory, "Icon.png");

        return fs.existsSync(iconCandidate);
    });

    if (directoryWithIcon) {
        return directoryWithIcon;
    }

    return candidates[0];
}

function extractDirectory(configuredPath) {
    if (!configuredPath || typeof configuredPath !== "string") {
        return "";
    }

    const trimmedPath = configuredPath.trim();

    if (!trimmedPath) {
        return "";
    }

    const resolvedPath = path.resolve(trimmedPath);

    return path.dirname(resolvedPath);
}

/**
 * Check if the static web app should be enabled based on the environment variable.
 * Defaults to true so the interface stays available unless explicitly disabled.
 */
function isWebAppEnabled() {
    const flag = process.env.ENABLE_WEB_APP;

    if (typeof flag !== "string") {
        return true;
    }

    const normalizedFlag = flag.trim().toLowerCase();
    const disabledValues = ["false", "0", "off", "no"];

    return !disabledValues.includes(normalizedFlag);
}
