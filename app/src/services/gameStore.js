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
        serviceId: gameInput.serviceId,
        coolifyBaseUrl: gameInput.coolifyBaseUrl,
        coolifyToken: gameInput.coolifyToken,
        imageUrl: gameInput.imageUrl || "",
        discordVoiceChannelIds: normalizeChannelIds(gameInput.discordVoiceChannelIds),
        instructions: typeof gameInput.instructions === "string" ? gameInput.instructions : ""
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

    if (typeof updates.serviceId === "string") {
        game.serviceId = updates.serviceId;
    }

    if (typeof updates.coolifyBaseUrl === "string") {
        game.coolifyBaseUrl = updates.coolifyBaseUrl;
    }

    if (typeof updates.coolifyToken === "string") {
        game.coolifyToken = updates.coolifyToken;
    }

    if (typeof updates.imageUrl === "string") {
        game.imageUrl = updates.imageUrl;
    }

    if (Array.isArray(updates.discordVoiceChannelIds)) {
        game.discordVoiceChannelIds = normalizeChannelIds(updates.discordVoiceChannelIds);
    }

    if (typeof updates.instructions === "string") {
        game.instructions = updates.instructions;
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
                    serviceId: game.serviceId,
                    coolifyBaseUrl: game.coolifyBaseUrl,
                    coolifyToken: game.coolifyToken,
                    imageUrl: game.imageUrl || "",
                    discordVoiceChannelIds: normalizeChannelIds(game.discordVoiceChannelIds || game.voiceChannelIds),
                    instructions: typeof game.instructions === "string" ? game.instructions : ""
                };
            });
        }

        return [];
    } catch (error) {
        console.error("Impossible de parser GAME_PRESETS", error.message);
        return [];
    }
}

function normalizeChannelIds(rawValue) {
    if (!rawValue) {
        return [];
    }

    if (Array.isArray(rawValue)) {
        return rawValue
            .filter(function keepNonEmpty(value) {
                return typeof value === "string" && value.trim() !== "";
            })
            .map(function trimValue(value) {
                return value.trim();
            });
    }

    if (typeof rawValue === "string" && rawValue.trim() !== "") {
        return [rawValue.trim()];
    }

    return [];
}
