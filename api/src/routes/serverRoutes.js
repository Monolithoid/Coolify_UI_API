import express from "express";
import { startService, stopService } from "../services/coolifyClient.js";
import { findGameById } from "../services/gameStore.js";

const router = express.Router();

router.post("/:gameId/start", async function handleStart(req, res) {
    try {
        const game = findGameById(req.params.gameId);

        if (!game) {
            res.status(404).json({ message: "Jeu introuvable" });
            return;
        }

        const response = await startService(game);
        res.json({ message: response, gameId: game.id });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors du démarrage", detail: error.message });
    }
});

router.post("/:gameId/stop", async function handleStop(req, res) {
    try {
        const game = findGameById(req.params.gameId);

        if (!game) {
            res.status(404).json({ message: "Jeu introuvable" });
            return;
        }

        const response = await stopService(game);
        res.json({ message: response, gameId: game.id });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'arrêt", detail: error.message });
    }
});

export default router;
