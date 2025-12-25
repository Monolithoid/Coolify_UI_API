import express from "express";
import { getDiscordStatus } from "../services/discordBotService.js";

const router = express.Router();

router.get("/status", function handleStatus(_req, res) {
    res.json({ bot: getDiscordStatus() });
});

export default router;
