import axios from "axios";

/**
 * Ask Coolify to start the service associated with the given game.
 */
export async function startService(game) {
    const client = buildHttpClient();
    const path = buildServiceActionPath(game, "start");

    const response = await client.post(path);
    return response.data?.message || "Start requested";
}

/**
 * Ask Coolify to stop the service associated with the given game.
 */
export async function stopService(game) {
    const client = buildHttpClient();
    const path = buildServiceActionPath(game, "stop");

    const response = await client.post(path);
    return response.data?.message || "Stop requested";
}

/**
 * Build an axios HTTP client configured with the resolved Coolify credentials.
 */
function buildHttpClient() {
    const resolved = resolveCredentials();

    if (!resolved.baseURL) {
        throw new Error("Missing Coolify base URL");
    }

    if (!resolved.token) {
        throw new Error("Missing Coolify token");
    }

    return axios.create({
        baseURL: resolved.baseURL,
        headers: {
            Authorization: "Bearer " + resolved.token,
            "Content-Type": "application/json"
        }
    });
}

/**
 * Generate the Coolify API path for a service start/stop action.
 */
function buildServiceActionPath(game, action) {
    if (!game?.serviceId) {
        throw new Error("Missing Coolify service id");
    }

    const encodedId = encodeURIComponent(game.serviceId);
    return `/services/${encodedId}/${action}`;
}

const sharedCredentials = {
    baseURL: process.env.COOLIFY_BASE_URL,
    token: process.env.COOLIFY_TOKEN
};

/**
 * Resolve Coolify credentials by combining environment variables and game data.
 */
function resolveCredentials() {
    return {
        baseURL: sharedCredentials.baseURL,
        token: sharedCredentials.token
    };
}
