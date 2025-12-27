import express from "express";
import { addGame, deleteGame, findGameById, listGames, updateGame } from "../services/gameStore.js";

const router = express.Router();

/**
 * Return the full list of available games.
 */
router.get("/", function handleList(_req, res) {
    res.json({ games: listGames() });
});

/**
 * Create a new game using the data provided in the request body.
 */
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

/**
 * Update an existing game identified by its id.
 */
router.put("/:gameId", function handleUpdate(req, res) {
    try {
        validateGamePayload(req.body, false);
        const updated = updateGame(req.params.gameId, req.body);
        res.json({ game: updated });
    } catch (error) {
        const status = error.message === "Game not found" ? 404 : 400;
        res.status(status).json({ message: error.message });
    }
});

/**
 * Delete an existing game and return the removed entry.
 */
router.delete("/:gameId", function handleDelete(req, res) {
    try {
        const removed = deleteGame(req.params.gameId);
        res.json({ game: removed });
    } catch (error) {
        const status = error.message === "Game not found" ? 404 : 400;
        res.status(status).json({ message: error.message });
    }
});

/**
 * Retrieve the detailed information of a given game.
 */
router.get("/:gameId", function handleGetOne(req, res) {
    const game = findGameById(req.params.gameId);

    if (!game) {
        res.status(404).json({ message: "Game not found" });
        return;
    }

    res.json({ game });
});

/**
 * Validate required properties for creating or updating a game.
 */
function validateGamePayload(payload, requireId) {
    if (requireId && !payload.id) {
        throw new Error("Game id is required");
    }

    if (!payload.name) {
        throw new Error("Game name is required");
    }

    if (!payload.serviceId) {
        throw new Error("Coolify serviceId is required");
    }

    if (!payload.imageUrl || typeof payload.imageUrl !== "string" || !payload.imageUrl.trim()) {
        throw new Error("Game image is required");
    }

    if (payload.discordVoiceChannelId && typeof payload.discordVoiceChannelId !== "string") {
        throw new Error("discordVoiceChannelId must be a Discord channel id as a string");
    }

    if (payload.instructions && typeof payload.instructions !== "string") {
        throw new Error("instructions must be a string");
    }
}

export default router;
