import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { startService, stopService } from "./coolifyClient.js";
import { findGameById, listGames } from "./gameStore.js";

dotenv.config();

const shutdownTimeouts = new Map();
const channelMappings = loadChannelMappings();
const shutdownDelayMs = resolveShutdownDelayMs();
const instructionOverrides = loadInstructionOverrides();

let discordClient = null;
let botState = buildInitialState();

export function startDiscordIntegration() {
    if (discordClient) {
        return botState;
    }

    if (!process.env.DISCORD_TOKEN) {
        botState = buildDisabledState("DISCORD_TOKEN manquant, bot non initialisé");
        return botState;
    }

    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates
        ]
    });

    botState.enabled = true;
    botState.ready = false;
    botState.lastError = null;

    discordClient.on("ready", function handleReady() {
        botState.ready = true;
        botState.lastError = null;
        console.log("Bot Discord connecté en tant que", discordClient.user.tag);
    });

    discordClient.on("voiceStateUpdate", async function handleVoiceChange(oldState, newState) {
        try {
            const joinedContext = resolveContext(newState.channelId);
            const leftContext = resolveContext(oldState.channelId);

            if (joinedContext) {
                await requestStart(joinedContext);
                await sendInstructions(joinedContext, newState.guild, newState.channel);
                clearPendingShutdown(joinedContext.channelKey);
            }

            if (leftContext) {
                scheduleShutdownIfEmpty(newState.guild, leftContext);
            }
        } catch (error) {
            botState.lastError = error.message;
            console.error("Erreur lors du traitement Discord", error);
        }
    });

    discordClient.on("error", function handleClientError(error) {
        botState.lastError = error.message;
        console.error("Erreur du client Discord", error);
    });

    discordClient.login(process.env.DISCORD_TOKEN).catch(function handleLoginError(error) {
        botState = buildDisabledState(error.message);
        discordClient = null;
        console.error("Échec de connexion du bot Discord", error);
    });

    return botState;
}

export function getDiscordStatus() {
    return {
        enabled: botState.enabled,
        ready: botState.ready,
        lastError: botState.lastError,
        mappedChannels: channelMappings.map(function mapChannels(entry) {
            return {
                channelId: entry.channelId,
                gameId: entry.gameId
            };
        })
    };
}

function resolveShutdownDelayMs() {
    const defaultDelaySeconds = 10 * 60;
    const rawValue = process.env.SERVER_STOP_DELAY_SECONDS;

    if (!rawValue) {
        return defaultDelaySeconds * 1000;
    }

    const parsedValue = Number(rawValue);
    const isValidNumber = Number.isFinite(parsedValue);
    const isPositive = parsedValue > 0;

    if (!isValidNumber || !isPositive) {
        return defaultDelaySeconds * 1000;
    }

    return parsedValue * 1000;
}

function requestStart(context) {
    const game = findGameById(context.gameId);

    if (!game) {
        console.warn("Aucun jeu associé au salon", context.channelKey);
        return Promise.resolve();
    }

    return startService(game).then(function logStart(response) {
        console.log("Démarrage demandé pour", game.id, response);
    }).catch(function logError(error) {
        console.error("Échec du démarrage pour", game.id, error.message);
    });
}

function sendInstructions(context, guild, joinedChannel) {
    const instructions = resolveInstructions(context);

    if (!instructions) {
        return Promise.resolve();
    }

    const targetChannel = resolveInstructionChannel(guild, joinedChannel, context.channelKey);

    if (!targetChannel) {
        console.warn("Impossible d'envoyer les instructions : aucun salon disponible pour", context.channelKey);
        return Promise.resolve();
    }

    return targetChannel.send(instructions).catch(function handleSendError(error) {
        console.error("Impossible d'envoyer les instructions", error.message);
    });
}

function scheduleShutdownIfEmpty(guild, context) {
    const channel = guild.channels.cache.get(context.channelKey);

    if (!channel) {
        return;
    }

    const hasMembers = channel.members.size > 0;

    if (hasMembers) {
        return;
    }

    clearPendingShutdown(context.channelKey);

    const timeout = setTimeout(function handleShutdownTimer() {
        requestStop(context);
    }, shutdownDelayMs);

    shutdownTimeouts.set(context.channelKey, timeout);
}

function resolveInstructionChannel(guild, joinedChannel, channelKey) {
    const channelFromEvent = findSendableChannel(joinedChannel);

    if (channelFromEvent) {
        return channelFromEvent;
    }

    const configuredChannel = findSendableChannel(guild?.channels?.cache?.get(channelKey));

    if (configuredChannel) {
        return configuredChannel;
    }

    const siblingChannel = findSiblingChannelWithSend(guild, joinedChannel);

    if (siblingChannel) {
        return siblingChannel;
    }

    const systemChannel = guild?.systemChannel;

    if (canSendMessages(systemChannel)) {
        return systemChannel;
    }

    return null;
}

function clearPendingShutdown(channelKey) {
    if (!channelKey) {
        return;
    }

    const timeout = shutdownTimeouts.get(channelKey);

    if (timeout) {
        clearTimeout(timeout);
        shutdownTimeouts.delete(channelKey);
    }
}

function requestStop(context) {
    const game = findGameById(context.gameId);

    if (!game) {
        console.warn("Aucun jeu associé au salon", context.channelKey);
        return Promise.resolve();
    }

    return stopService(game).then(function logStop(response) {
        console.log("Arrêt demandé pour", game.id, response);
    }).catch(function logError(error) {
        console.error("Échec de l'arrêt pour", game.id, error.message);
    });
}

function resolveInstructions(context) {
    const mappingInstructions = typeof context.instructions === "string" ? context.instructions.trim() : "";

    if (mappingInstructions) {
        return mappingInstructions;
    }

    const override = instructionOverrides[context.gameId];

    if (override) {
        return override;
    }

    const game = findGameById(context.gameId);

    if (game && typeof game.instructions === "string" && game.instructions.trim()) {
        return game.instructions.trim();
    }

    return "";
}

function findSendableChannel(channel) {
    if (!channel) {
        return null;
    }

    if (canSendMessages(channel)) {
        return channel;
    }

    return null;
}

function findSiblingChannelWithSend(guild, sourceChannel) {
    if (!guild || !sourceChannel || !sourceChannel.parentId) {
        return null;
    }

    const sibling = guild.channels.cache.find(function locateSibling(channel) {
        return channel.parentId === sourceChannel.parentId && canSendMessages(channel);
    });

    return sibling || null;
}

function canSendMessages(channel) {
    return Boolean(channel) && typeof channel.send === "function";
}

function resolveContext(channelId) {
    if (!channelId) {
        return null;
    }

    const mapping = channelMappings.find(function matchMapping(entry) {
        return entry.channelId === channelId;
    });

    if (mapping) {
        return mapping;
    }

    return null;
}

function loadChannelMappings() {
    const parsedMappings = parseMappingFromEnvironment();

    if (parsedMappings.length > 0) {
        return parsedMappings;
    }

    const mappingsFromPresets = buildMappingsFromGames();

    if (mappingsFromPresets.length > 0) {
        return mappingsFromPresets;
    }

    if (!process.env.DISCORD_VOICE_CHANNEL_ID || !process.env.DISCORD_DEFAULT_GAME_ID) {
        return [];
    }

    return [
        {
            channelId: process.env.DISCORD_VOICE_CHANNEL_ID,
            channelKey: process.env.DISCORD_VOICE_CHANNEL_ID,
            gameId: process.env.DISCORD_DEFAULT_GAME_ID
        }
    ];
}

function loadInstructionOverrides() {
    const rawValue = process.env.DISCORD_GAME_INSTRUCTION_MAPPINGS;

    if (!rawValue) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (Array.isArray(parsed)) {
            return parsed.reduce(function reduceArray(accumulator, entry) {
                if (entry && typeof entry.gameId === "string" && typeof entry.instructions === "string") {
                    accumulator[entry.gameId] = entry.instructions.trim();
                }

                return accumulator;
            }, {});
        }

        if (parsed && typeof parsed === "object") {
            return Object.keys(parsed).reduce(function reduceObject(accumulator, key) {
                const value = parsed[key];

                if (typeof value === "string") {
                    accumulator[key] = value.trim();
                }

                return accumulator;
            }, {});
        }

        return {};
    } catch (error) {
        console.error("Impossible de parser DISCORD_GAME_INSTRUCTION_MAPPINGS", error.message);
        botState.lastError = error.message;
        return {};
    }
}

function parseMappingFromEnvironment() {
    const raw = process.env.DISCORD_GAME_CHANNEL_MAPPINGS;

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.map(function normalize(entry) {
            return {
                channelId: entry.channelId,
                channelKey: entry.channelId,
                gameId: entry.gameId,
                instructions: entry.instructions
            };
        }).filter(function removeIncomplete(entry) {
            return Boolean(entry.channelId) && Boolean(entry.gameId);
        });
    } catch (error) {
        console.error("Impossible de parser DISCORD_GAME_CHANNEL_MAPPINGS", error.message);
        botState.lastError = error.message;
        return [];
    }
}

function buildMappingsFromGames() {
    return listGames()
        .flatMap(function expandChannels(game) {
            if (!Array.isArray(game.discordVoiceChannelIds) || game.discordVoiceChannelIds.length === 0) {
                return [];
            }

            return game.discordVoiceChannelIds.map(function buildMapping(channelId) {
                return {
                    channelId: channelId,
                    channelKey: channelId,
                    gameId: game.id,
                    instructions: game.instructions
                };
            });
        })
        .filter(function keepValid(mapping) {
            return Boolean(mapping.channelId) && Boolean(mapping.gameId);
        });
}

function buildInitialState() {
    return {
        enabled: false,
        ready: false,
        lastError: null
    };
}

function buildDisabledState(reason) {
    return {
        enabled: false,
        ready: false,
        lastError: reason
    };
}
