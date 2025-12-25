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

export async function fetchProjectsAndServices(credentials) {
    const client = buildHttpClient(credentials);
    const projects = await fetchProjects(client);

    const serviceResults = await Promise.all(projects.map(async function collectServices(project) {
        const services = await fetchServices(client, project);

        return services.map(function normalize(service) {
            return buildGameCandidate(project, service);
        });
    }));

    return serviceResults.flat();
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
        projectId: game.projectId,
        serviceId: game.serviceId
    };
}

function resolveCredentials(source) {
    const baseURL = source?.coolifyBaseUrl || process.env.COOLIFY_BASE_URL;
    const token = source?.coolifyToken || process.env.COOLIFY_TOKEN;

    return { baseURL, token };
}

async function fetchProjects(client) {
    const response = await client.get("/projects");
    const payload = response.data;
    const projects = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.projects)
            ? payload.projects
            : Array.isArray(payload)
                ? payload
                : [];

    return projects;
}

async function fetchServices(client, project) {
    const identifier = project.uuid || project.id || project.projectId;

    if (!identifier) {
        return [];
    }

    const response = await client.get("/projects/" + identifier + "/services");
    const payload = response.data;
    const services = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.services)
            ? payload.services
            : Array.isArray(payload)
                ? payload
                : [];

    return services;
}

function buildGameCandidate(project, service) {
    const projectId = project.uuid || project.id || project.projectId;
    const serviceId = service.uuid || service.id || service.serviceId;
    const projectName = project.name || project.title || project.slug || projectId;
    const serviceName = service.name || service.description || service.slug || serviceId;

    return {
        projectId,
        projectName,
        serviceId,
        serviceName
    };
}
