import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { startService, stopService } from "./coolifyClient.js";
import { findGameById, listGames, onGamesChanged } from "./gameStore.js";

dotenv.config();

const shutdownTimeouts = new Map();
let channelMappings = loadChannelMappings();
const shutdownDelayMs = resolveShutdownDelayMs();
const instructionOverrides = loadInstructionOverrides();

let discordClient = null;
let botState = buildInitialState();

onGamesChanged(function handleGamesUpdate() {
    refreshChannelMappings();
});

/**
 * Initialize and connect the Discord bot when a token is available.
 * Return the current bot state even if configuration is missing.
 */
export function startDiscordIntegration() {
    if (discordClient) {
        return botState;
    }

    if (!process.env.DISCORD_TOKEN) {
        botState = buildDisabledState("Missing DISCORD_TOKEN, bot not initialized");
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
        console.log("Discord bot connected as", discordClient.user.tag);
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
            console.error("Error while processing Discord events", error);
        }
    });

    discordClient.on("error", function handleClientError(error) {
        botState.lastError = error.message;
        console.error("Discord client error", error);
    });

    discordClient.login(process.env.DISCORD_TOKEN).catch(function handleLoginError(error) {
        botState = buildDisabledState(error.message);
        discordClient = null;
        console.error("Discord bot login failed", error);
    });

    return botState;
}

/**
 * Provide a summarized Discord bot state for the API.
 */
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

function refreshChannelMappings() {
    channelMappings = loadChannelMappings();
}

/**
 * Compute the delay before automatically stopping services after users leave.
 */
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

/**
 * Ask Coolify to start the game associated with a Discord voice channel.
 */
function requestStart(context) {
    const game = findGameById(context.gameId);

    if (!game) {
        console.warn("No game mapped to channel", context.channelKey);
        return Promise.resolve();
    }

    return startService(game).then(function logStart(response) {
        console.log("Start requested for", game.id, response);
    }).catch(function logError(error) {
        console.error("Failed to start", game.id, error.message);
    });
}

/**
 * Send connection or access instructions to an appropriate Discord channel.
 */
function sendInstructions(context, guild, joinedChannel) {
    const instructions = resolveInstructions(context);

    if (!instructions) {
        return Promise.resolve();
    }

    const targetChannel = resolveInstructionChannel(guild, joinedChannel, context.channelKey);

    if (!targetChannel) {
        console.warn("Cannot send instructions: no available channel for", context.channelKey);
        return Promise.resolve();
    }

    return targetChannel.send(instructions).catch(function handleSendError(error) {
        console.error("Failed to send instructions", error.message);
    });
}

/**
 * Schedule a service shutdown if the mapped voice channel is empty.
 */
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

/**
 * Select the most suitable channel to send instruction messages.
 */
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

/**
 * Cancel a planned shutdown for a specific channel.
 */
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

/**
 * Ask Coolify to stop the game associated with a Discord voice channel.
 */
function requestStop(context) {
    const game = findGameById(context.gameId);

    if (!game) {
        console.warn("No game mapped to channel", context.channelKey);
        return Promise.resolve();
    }

    return stopService(game).then(function logStop(response) {
        console.log("Stop requested for", game.id, response);
    }).catch(function logError(error) {
        console.error("Failed to stop", game.id, error.message);
    });
}

/**
 * Determine the instruction text to send based on mappings and configured games.
 */
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

/**
 * Check whether a Discord channel can receive messages and return it if so.
 */
function findSendableChannel(channel) {
    if (!channel) {
        return null;
    }

    if (canSendMessages(channel)) {
        return channel;
    }

    return null;
}

/**
 * Find a sibling channel in the same category that can send messages.
 */
function findSiblingChannelWithSend(guild, sourceChannel) {
    if (!guild || !sourceChannel || !sourceChannel.parentId) {
        return null;
    }

    const sibling = guild.channels.cache.find(function locateSibling(channel) {
        return channel.parentId === sourceChannel.parentId && canSendMessages(channel);
    });

    return sibling || null;
}

/**
 * Indicate whether a channel exposes a send method.
 */
function canSendMessages(channel) {
    return Boolean(channel) && typeof channel.send === "function";
}

/**
 * Map a voice channel id to its configured mapping entry.
 */
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

/**
 * Build the mapping between voice channels and games from configuration.
 */
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

/**
 * Read per-game instruction overrides from an environment variable.
 */
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
        console.error("Failed to parse DISCORD_GAME_INSTRUCTION_MAPPINGS", error.message);
        botState.lastError = error.message;
        return {};
    }
}

/**
 * Parse DISCORD_GAME_CHANNEL_MAPPINGS to retrieve game/channel associations.
 */
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
        console.error("Failed to parse DISCORD_GAME_CHANNEL_MAPPINGS", error.message);
        botState.lastError = error.message;
        return [];
    }
}

/**
 * Generate game/channel mappings from configured games.
 */
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

/**
 * Create a neutral initial state for the Discord bot.
 */
function buildInitialState() {
    return {
        enabled: false,
        ready: false,
        lastError: null
    };
}

/**
 * Create a disabled state that records why the bot is stopped.
 */
function buildDisabledState(reason) {
    return {
        enabled: false,
        ready: false,
        lastError: reason
    };
}
