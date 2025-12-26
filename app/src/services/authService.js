import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { isEmailAllowed } from "./allowedEmails.js";

dotenv.config();

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI || "";
const allowedEmailsFile = process.env.ALLOWED_EMAILS_FILE || "";
const oauthClient = buildOauthClient(clientId, clientSecret, redirectUri);

export async function verifySessionToken(idToken) {
    if (!idToken) {
        throw new Error("Missing id token");
    }

    const payload = await verifyGoogleToken(idToken);

    if (!isEmailAllowed(payload.email, allowedEmailsFile)) {
        throw new Error("Email not authorized");
    }

    return payload;
}

export async function authenticateWithAuthCode(code) {
    if (!clientSecret) {
        throw new Error("GOOGLE_CLIENT_SECRET is not configured");
    }

    if (!redirectUri) {
        throw new Error("GOOGLE_REDIRECT_URI is not configured");
    }

    if (!code) {
        throw new Error("Missing authorization code");
    }

    const tokens = await exchangeAuthorizationCode(code);

    if (!tokens.id_token) {
        throw new Error("Missing ID token from Google");
    }

    const payload = await verifyGoogleToken(tokens.id_token);

    return { payload, idToken: tokens.id_token };
}

export function getAuthConfig() {
    return {
        clientId,
        redirectUri,
        emailFile: allowedEmailsFile
    };
}

export async function verifyGoogleToken(idToken) {
    if (!clientId) {
        throw new Error("GOOGLE_CLIENT_ID is not configured");
    }

    const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: clientId
    });

    const payload = ticket.getPayload();

    if (!payload) {
        throw new Error("Token payload missing");
    }

    return {
        email: payload.email || "",
        name: payload.name || "",
        picture: payload.picture || "",
        expiresAt: payload.exp,
        issuedAt: payload.iat,
        subject: payload.sub
    };
}

async function exchangeAuthorizationCode(code) {
    if (!clientId) {
        throw new Error("GOOGLE_CLIENT_ID is not configured");
    }

    const { tokens } = await oauthClient.getToken({ code, redirect_uri: redirectUri });

    if (!tokens) {
        throw new Error("Google token exchange failed");
    }

    return tokens;
}

function buildOauthClient(googleClientId, googleClientSecret, googleRedirectUri) {
    return new OAuth2Client(googleClientId, googleClientSecret, googleRedirectUri);
}
