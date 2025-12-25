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

function buildHttpClient(game) {
    const token = game.coolifyToken || process.env.COOLIFY_TOKEN;
    const baseURL = game.coolifyBaseUrl || process.env.COOLIFY_BASE_URL;

    return axios.create({
        baseURL,
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
        }
    });
}

function buildDeploymentContext(game) {
    return {
        projectId: game.projectId,
        serviceId: game.serviceId
    };
}
