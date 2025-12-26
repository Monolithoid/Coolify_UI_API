import dotenv from "dotenv";

dotenv.config();

const games = loadInitialGames();

/**
 * Return all games stored in memory.
 */
export function listGames() {
    return games;
}

/**
 * Find a game by its unique identifier.
 */
export function findGameById(gameId) {
    return games.find(function matchGame(game) {
        return game.id === gameId;
    });
}

/**
 * Add a new game while enforcing uniqueness and normalizing data.
 */
export function addGame(gameInput) {
    const existingGame = findGameById(gameInput.id);

    if (existingGame) {
        throw new Error("A game with this id already exists");
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

/**
 * Update an existing game with the provided properties.
 */
export function updateGame(gameId, updates) {
    const game = findGameById(gameId);

    if (!game) {
        throw new Error("Game not found");
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

/**
 * Delete a game by id and return the removed entry.
 */
export function deleteGame(gameId) {
    const index = games.findIndex(function findIndexById(game) {
        return game.id === gameId;
    });

    if (index === -1) {
        throw new Error("Game not found");
    }

    const removed = games.splice(index, 1);
    return removed[0];
}

/**
 * Load games from the GAME_PRESETS environment variable.
 */
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
        console.error("Failed to parse GAME_PRESETS", error.message);
        return [];
    }
}

/**
 * Normalize Discord voice channel ids into an array of strings.
 */
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
