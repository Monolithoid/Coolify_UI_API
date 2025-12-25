import express from "express";
import { startService, stopService } from "../services/coolifyClient.js";

const router = express.Router();

router.post("/start", async function handleStart(req, res) {
    try {
        const response = await startService();
        res.json({ message: response });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors du démarrage", detail: error.message });
    }
});

router.post("/stop", async function handleStop(req, res) {
    try {
        const response = await stopService();
        res.json({ message: response });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'arrêt", detail: error.message });
    }
});

export default router;
