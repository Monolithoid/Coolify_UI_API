import express from "express";
import cookieParser from "cookie-parser";
import { authenticateWithAuthCode, getAuthConfig } from "../services/authService.js";
import { isEmailAllowed } from "../services/allowedEmails.js";
import { requireAuth } from "../services/authMiddleware.js";

const router = express.Router();

router.use(cookieParser());

router.get("/config", function handleConfig(_req, res) {
    const config = getAuthConfig();
    res.json({
        clientId: config.clientId,
        redirectUri: config.redirectUri
    });
});

router.get("/session", requireAuth, function handleSession(req, res) {
    res.json({ user: req.user });
});

router.post("/login", async function handleLogin(req, res) {
    try {
        const authCode = req.body && req.body.code;

        if (!authCode) {
            res.status(400).json({ message: "Missing Google authorization code" });
            return;
        }

        const { payload, idToken } = await authenticateWithAuthCode(authCode);

        if (!isEmailAllowed(payload.email, process.env.ALLOWED_EMAILS_FILE)) {
            res.status(403).json({ message: "Email not authorized" });
            return;
        }

        setSessionCookie(res, idToken);

        res.json({
            message: "Connexion réussie",
            user: {
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            }
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

router.post("/logout", function handleLogout(_req, res) {
    res.clearCookie("session_token");
    res.json({ message: "Session terminée" });
});

function setSessionCookie(res, token) {
    const secure = (process.env.COOKIE_SECURE || "false").toLowerCase() === "true";

    res.cookie("session_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: 1000 * 60 * 60
    });
}

export default router;
