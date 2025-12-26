import express from "express";
import { startService, stopService } from "../services/coolifyClient.js";
import { findGameById } from "../services/gameStore.js";

const router = express.Router();

/**
 * Start the Coolify service linked to the requested game.
 */
router.post("/:gameId/start", async function handleStart(req, res) {
    try {
        const game = findGameById(req.params.gameId);

        if (!game) {
            res.status(404).json({ message: "Game not found" });
            return;
        }

        const response = await startService(game);
        res.json({ message: response, gameId: game.id });
    } catch (error) {
        res.status(500).json({ message: "Error while starting", detail: error.message });
    }
});

/**
 * Stop the Coolify service for the specified game.
 */
router.post("/:gameId/stop", async function handleStop(req, res) {
    try {
        const game = findGameById(req.params.gameId);

        if (!game) {
            res.status(404).json({ message: "Game not found" });
            return;
        }

        const response = await stopService(game);
        res.json({ message: response, gameId: game.id });
    } catch (error) {
        res.status(500).json({ message: "Error while stopping", detail: error.message });
    }
});

export default router;
