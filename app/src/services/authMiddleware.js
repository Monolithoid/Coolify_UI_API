import { verifySessionToken } from "./authService.js";

export async function requireAuth(req, res, next) {
    try {
        const token = extractToken(req);

        if (!token) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const user = await verifySessionToken(token);
        req.user = user;
        next();
    } catch (error) {
        const statusCode = error.message === "Email not authorized" ? 403 : 401;
        res.status(statusCode).json({ message: error.message });
    }
}

function extractToken(req) {
    const bearerHeader = req.headers.authorization;

    if (bearerHeader && bearerHeader.startsWith("Bearer ")) {
        return bearerHeader.replace("Bearer ", "");
    }

    if (req.cookies && req.cookies.session_token) {
        return req.cookies.session_token;
    }

    return "";
}
