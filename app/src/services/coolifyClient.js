import axios from "axios";

export async function startService(game) {
    const client = buildHttpClient(game);
    const context = buildDeploymentContext(game);

    const body = { action: "start", ...context };
    const response = await client.post("/deploy", body);
    return response.data?.message || "Démarrage demandé";
}

export async function stopService(game) {
    const client = buildHttpClient(game);
    const context = buildDeploymentContext(game);

    const body = { action: "stop", ...context };
    const response = await client.post("/deploy", body);
    return response.data?.message || "Arrêt demandé";
}

function buildHttpClient(source) {
    const resolved = resolveCredentials(source);

    if (!resolved.baseURL) {
        throw new Error("Aucune URL Coolify renseignée");
    }

    if (!resolved.token) {
        throw new Error("Aucun token Coolify renseigné");
    }

    return axios.create({
        baseURL: resolved.baseURL,
        headers: {
            Authorization: "Bearer " + resolved.token,
            "Content-Type": "application/json"
        }
    });
}

function buildDeploymentContext(game) {
    return {
        serviceId: game.serviceId
    };
}

const sharedCredentials = {
    baseURL: process.env.COOLIFY_BASE_URL,
    token: process.env.COOLIFY_TOKEN
};

function resolveCredentials(source) {
    if (!sharedCredentials.baseURL && source?.coolifyBaseUrl) {
        sharedCredentials.baseURL = source.coolifyBaseUrl;
    }

    if (!sharedCredentials.token && source?.coolifyToken) {
        sharedCredentials.token = source.coolifyToken;
    }

    return {
        baseURL: sharedCredentials.baseURL,
        token: sharedCredentials.token
    };
}
