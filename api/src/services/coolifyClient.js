import axios from "axios";

function getHttpClient() {
    const token = process.env.COOLIFY_TOKEN;
    const baseURL = process.env.COOLIFY_BASE_URL;

    return axios.create({
        baseURL,
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
        }
    });
}

function getDeploymentContext() {
    return {
        projectId: process.env.COOLIFY_PROJECT_ID,
        serviceId: process.env.COOLIFY_SERVICE_ID
    };
}

export async function startService() {
    const client = getHttpClient();
    const context = getDeploymentContext();

    const body = { action: "start", ...context };
    const response = await client.post("/deploy", body);
    return response.data?.message || "Démarrage demandé";
}

export async function stopService() {
    const client = getHttpClient();
    const context = getDeploymentContext();

    const body = { action: "stop", ...context };
    const response = await client.post("/deploy", body);
    return response.data?.message || "Arrêt demandé";
}
