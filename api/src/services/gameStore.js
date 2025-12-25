import dotenv from "dotenv";

dotenv.config();

const games = loadInitialGames();

export function listGames() {
    return games;
}

export function findGameById(gameId) {
    return games.find(function matchGame(game) {
        return game.id === gameId;
    });
}

export function addGame(gameInput) {
    const existingGame = findGameById(gameInput.id);

    if (existingGame) {
        throw new Error("Un jeu avec cet identifiant existe déjà");
    }

    const gameToStore = {
        id: gameInput.id,
        name: gameInput.name,
        projectId: gameInput.projectId,
        serviceId: gameInput.serviceId,
        coolifyBaseUrl: gameInput.coolifyBaseUrl,
        coolifyToken: gameInput.coolifyToken
    };

    games.push(gameToStore);
    return gameToStore;
}

export function updateGame(gameId, updates) {
    const game = findGameById(gameId);

    if (!game) {
        throw new Error("Jeu introuvable");
    }

    if (typeof updates.name === "string") {
        game.name = updates.name;
    }

    if (typeof updates.projectId === "string") {
        game.projectId = updates.projectId;
    }

    if (typeof updates.serviceId === "string") {
        game.serviceId = updates.serviceId;
    }

    if (typeof updates.coolifyBaseUrl === "string") {
        game.coolifyBaseUrl = updates.coolifyBaseUrl;
    }

    if (typeof updates.coolifyToken === "string") {
        game.coolifyToken = updates.coolifyToken;
    }

    return game;
}

export function deleteGame(gameId) {
    const index = games.findIndex(function findIndexById(game) {
        return game.id === gameId;
    });

    if (index === -1) {
        throw new Error("Jeu introuvable");
    }

    const removed = games.splice(index, 1);
    return removed[0];
}

function loadInitialGames() {
    const presets = process.env.GAME_PRESETS;

    if (!presets) {
        return [];
    }

    try {
        const parsed = JSON.parse(presets);

        if (Array.isArray(parsed)) {
            return parsed.map(function normalizeGame(game) {
                return {
                    id: game.id,
                    name: game.name,
                    projectId: game.projectId,
                    serviceId: game.serviceId,
                    coolifyBaseUrl: game.coolifyBaseUrl,
                    coolifyToken: game.coolifyToken
                };
            });
        }

        return [];
    } catch (error) {
        console.error("Impossible de parser GAME_PRESETS", error.message);
        return [];
    }
}
