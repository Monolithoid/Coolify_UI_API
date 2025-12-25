import express from "express";
import { addGame, deleteGame, findGameById, listGames, updateGame } from "../services/gameStore.js";

const router = express.Router();

router.get("/", function handleList(_req, res) {
    res.json({ games: listGames() });
});

router.post("/", function handleCreate(req, res) {
    try {
        const payload = req.body;
        validateGamePayload(payload, true);
        const created = addGame(payload);
        res.status(201).json({ game: created });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put("/:gameId", function handleUpdate(req, res) {
    try {
        validateGamePayload(req.body, false);
        const updated = updateGame(req.params.gameId, req.body);
        res.json({ game: updated });
    } catch (error) {
        const status = error.message === "Jeu introuvable" ? 404 : 400;
        res.status(status).json({ message: error.message });
    }
});

router.delete("/:gameId", function handleDelete(req, res) {
    try {
        const removed = deleteGame(req.params.gameId);
        res.json({ game: removed });
    } catch (error) {
        const status = error.message === "Jeu introuvable" ? 404 : 400;
        res.status(status).json({ message: error.message });
    }
});

router.get("/:gameId", function handleGetOne(req, res) {
    const game = findGameById(req.params.gameId);

    if (!game) {
        res.status(404).json({ message: "Jeu introuvable" });
        return;
    }

    res.json({ game });
});

function validateGamePayload(payload, requireId) {
    if (requireId && !payload.id) {
        throw new Error("L'identifiant du jeu est requis");
    }

    if (!payload.name) {
        throw new Error("Le nom du jeu est requis");
    }

    if (!payload.serviceId) {
        throw new Error("Le serviceId Coolify est requis");
    }

    if (!payload.imageUrl || typeof payload.imageUrl !== "string" || !payload.imageUrl.trim()) {
        throw new Error("L'image du jeu est requise");
    }

    if (payload.discordVoiceChannelIds && !Array.isArray(payload.discordVoiceChannelIds)) {
        throw new Error("discordVoiceChannelIds doit être un tableau d'identifiants de salon Discord");
    }
}

export default router;
