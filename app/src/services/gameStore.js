import dotenv from "dotenv";
import EventEmitter from "events";
import fs from "fs";
import path from "path";

dotenv.config();

const persistence = resolvePersistenceTarget();
const games = loadInitialGames(persistence);
const changeEmitter = new EventEmitter();

startFileWatcher(persistence);

/**
 * Allow external consumers to react to changes in the games list.
 */
export function onGamesChanged(listener) {
    changeEmitter.on("change", listener);

    return function unsubscribe() {
        changeEmitter.off("change", listener);
    };
}

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
    persistGamesToFile();
    notifyChange();
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

    persistGamesToFile();
    notifyChange();
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
    persistGamesToFile();
    notifyChange();
    return removed[0];
}

/**
 * Load games from the GAME_PRESETS environment variable.
 */
function loadInitialGames(persistenceTarget) {
    const presetsFile = persistenceTarget.filePath;

    if (persistenceTarget.enabled && fs.existsSync(presetsFile)) {
        const loadedGames = loadPresetsFromFile(presetsFile);

        if (loadedGames) {
            return loadedGames;
        }

        return [];
    }

    const presets = process.env.GAME_PRESETS;

    if (!presets) {
        return [];
    }

    return parseGamePresets(presets);
}

/**
 * Load game presets from a JSON file if it exists and is readable.
 */
function loadPresetsFromFile(presetsFile) {
    try {
        const rawContent = fs.readFileSync(presetsFile, "utf-8");
        return parseGamePresets(rawContent);
    } catch (error) {
        console.error("Failed to read GAME_PRESETS_FILE", error.message);
        return null;
    }
}

/**
 * Parse a GAME_PRESETS payload and normalize the entries.
 */
function parseGamePresets(rawValue) {
    try {
        const parsed = JSON.parse(rawValue);

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

function resolvePersistenceTarget() {
    const configuredPath = process.env.GAME_PRESETS_FILE;

    if (!configuredPath || typeof configuredPath !== "string") {
        return { enabled: false, filePath: "" };
    }

    const trimmedPath = configuredPath.trim();

    if (!trimmedPath) {
        return { enabled: false, filePath: "" };
    }

    const resolvedPath = path.resolve(trimmedPath);
    const directory = path.dirname(resolvedPath);

    createDirectoryIfMissing(directory);
    createFileIfMissing(resolvedPath);

    return { enabled: true, filePath: resolvedPath };
}

function createDirectoryIfMissing(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        return;
    }

    try {
        fs.mkdirSync(directoryPath, { recursive: true });
    } catch (error) {
        console.error("Impossible de créer le dossier", directoryPath, error.message);
    }
}

function createFileIfMissing(filePath) {
    if (fs.existsSync(filePath)) {
        return;
    }

    try {
        fs.writeFileSync(filePath, "[]\n", "utf-8");
    } catch (error) {
        console.error("Impossible de créer le fichier des jeux", filePath, error.message);
    }
}

function persistGamesToFile() {
    if (!persistence.enabled) {
        return;
    }

    try {
        const serializedGames = JSON.stringify(games, null, 2) + "\n";
        fs.writeFileSync(persistence.filePath, serializedGames, "utf-8");
    } catch (error) {
        console.error("Impossible d'enregistrer les jeux", persistence.filePath, error.message);
    }
}

function startFileWatcher(persistenceTarget) {
    if (!persistenceTarget.enabled) {
        return;
    }

    try {
        fs.watchFile(persistenceTarget.filePath, { interval: 1000 }, function handleFileChange(current, previous) {
            if (current.mtimeMs === previous.mtimeMs) {
                return;
            }

            reloadGamesFromFile(persistenceTarget.filePath);
        });
    } catch (error) {
        console.error("Impossible de surveiller le fichier des jeux", error.message);
    }
}

function reloadGamesFromFile(presetsFile) {
    const reloadedGames = loadPresetsFromFile(presetsFile);

    if (!reloadedGames) {
        return;
    }

    replaceGames(reloadedGames);
}

function replaceGames(nextGames) {
    const currentLength = games.length;
    games.splice(0, currentLength, ...nextGames);
    notifyChange();
}

function notifyChange() {
    changeEmitter.emit("change", games);
}
