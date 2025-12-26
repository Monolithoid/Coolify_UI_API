import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let shutdownTimeouts = new Map();
const channelMappings = loadChannelMappings();
const instructionMappings = loadInstructionMappings();

client.on("ready", function handleReady() {
    console.log("Bot connecté en tant que", client.user.tag);
});

client.on("voiceStateUpdate", async function handleVoiceState(oldState, newState) {
    const previousChannelId = oldState.channelId;
    const nextChannelId = newState.channelId;

    const joinedContext = resolveContext(nextChannelId);
    const leftContext = resolveContext(previousChannelId);

    if (joinedContext) {
        await requestStart(joinedContext, newState.guild);
        clearPendingShutdown(joinedContext.channelKey);
    }

    if (leftContext) {
        scheduleShutdownIfEmpty(newState.guild, leftContext);
    }
});

client.login(process.env.DISCORD_TOKEN);

async function requestStart(context, guild) {
    const endpoint = context.apiBaseUrl + "/api/server/" + context.gameId + "/start";

    try {
        await axios.post(endpoint);
        console.log("Démarrage demandé pour", context.gameId);
        await notifyChannel(guild, context, buildStartMessage(context));
    } catch (error) {
        console.error("Échec du démarrage pour", context.gameId, error.message);
    }
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
        requestStop(context, guild);
    }, 10 * 60 * 1000);

    shutdownTimeouts.set(context.channelKey, timeout);
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

async function requestStop(context, guild) {
    const endpoint = context.apiBaseUrl + "/api/server/" + context.gameId + "/stop";

    try {
        await axios.post(endpoint);
        console.log("Arrêt demandé pour", context.gameId);
        await notifyChannel(guild, context, buildStopMessage(context));
    } catch (error) {
        console.error("Échec de l'arrêt pour", context.gameId, error.message);
    }
}

function buildStartMessage(context) {
    const instructions = resolveInstructions(context);

    return "Le serveur pour " + context.gameId + " vient d'être démarré. Instructions : " + instructions;
}

function buildStopMessage(context) {
    return "Le serveur pour " + context.gameId + " est en cours d'arrêt.";
}

async function notifyChannel(guild, context, message) {
    if (!guild) {
        return;
    }

    const channel = resolveDiscussionChannel(guild, context);

    if (!channel || !channel.isTextBased()) {
        console.warn("Impossible d'envoyer un message sur le canal", context.channelKey);
        return;
    }

    try {
        await channel.send(message);
    } catch (error) {
        console.error("Impossible d'envoyer un message sur le canal", context.channelKey, error.message);
    }
}

function resolveContext(channelId) {
    if (!channelId) {
        return null;
    }

    const mapping = channelMappings.find(function matchMapping(entry) {
        return entry.channelId === channelId;
    });

    if (mapping) {
        return {
            channelKey: mapping.channelId,
            gameId: mapping.gameId,
            apiBaseUrl: mapping.apiBaseUrl || process.env.API_BASE_URL,
            instructions: mapping.instructions,
            discussionChannelId: mapping.discussionChannelId || process.env.DISCORD_DISCUSSION_CHANNEL_ID
        };
    }

    if (!process.env.DISCORD_VOICE_CHANNEL_ID || process.env.DISCORD_VOICE_CHANNEL_ID !== channelId) {
        return null;
    }

    if (!process.env.DISCORD_DEFAULT_GAME_ID) {
        return null;
    }

    return {
        channelKey: process.env.DISCORD_VOICE_CHANNEL_ID,
        gameId: process.env.DISCORD_DEFAULT_GAME_ID,
        apiBaseUrl: process.env.API_BASE_URL,
        instructions: instructionMappings.get(process.env.DISCORD_DEFAULT_GAME_ID),
        discussionChannelId: process.env.DISCORD_DEFAULT_DISCUSSION_CHANNEL_ID || process.env.DISCORD_DISCUSSION_CHANNEL_ID
    };
}

function loadChannelMappings() {
    const raw = process.env.DISCORD_GAME_CHANNEL_MAPPINGS;

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            return parsed.map(function normalize(entry) {
                return {
                    channelId: entry.channelId,
                    gameId: entry.gameId,
                    apiBaseUrl: entry.apiBaseUrl,
                    instructions: entry.instructions,
                    discussionChannelId: entry.discussionChannelId
                };
            });
        }

        return [];
    } catch (error) {
        console.error("Impossible de parser DISCORD_GAME_CHANNEL_MAPPINGS", error.message);
        return [];
    }
}

function loadInstructionMappings() {
    const raw = process.env.DISCORD_GAME_INSTRUCTION_MAPPINGS;

    if (!raw) {
        return new Map();
    }

    try {
        const parsed = JSON.parse(raw);
        const entries = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(function fromObject(entry) {
            return { gameId: entry[0], instructions: entry[1] };
        });

        const normalized = entries
            .filter(function keepComplete(entry) {
                return Boolean(entry.gameId) && Boolean(entry.instructions);
            })
            .map(function normalize(entry) {
                return { gameId: entry.gameId, instructions: entry.instructions };
            });

        return new Map(normalized.map(function toTuple(entry) {
            return [entry.gameId, entry.instructions];
        }));
    } catch (error) {
        console.error("Impossible de parser DISCORD_GAME_INSTRUCTION_MAPPINGS", error.message);
        return new Map();
    }
}

function resolveInstructions(context) {
    const defaultInstructions = "Lancez votre client de jeu, rejoignez la partie et suivez les indications dans le salon.";

    if (!context) {
        return defaultInstructions;
    }

    if (context.instructions) {
        return context.instructions;
    }

    const mapped = instructionMappings.get(context.gameId);

    if (mapped) {
        return mapped;
    }

    if (process.env.DISCORD_GAME_INSTRUCTIONS) {
        return process.env.DISCORD_GAME_INSTRUCTIONS;
    }

    return defaultInstructions;
}

function resolveDiscussionChannel(guild, context) {
    const candidateIds = [
        context.discussionChannelId,
        process.env.DISCORD_DISCUSSION_CHANNEL_ID,
        context.channelKey
    ].filter(Boolean);

    for (const id of candidateIds) {
        const channel = guild.channels.cache.get(id);

        if (channel && channel.isTextBased()) {
            return channel;
        }
    }

    const voiceChannel = guild.channels.cache.get(context.channelKey);

    if (voiceChannel && voiceChannel.parentId) {
        const siblingTextChannel = guild.channels.cache.find(function matchSibling(channel) {
            return channel.parentId === voiceChannel.parentId && channel.type === ChannelType.GuildText;
        });

        if (siblingTextChannel && siblingTextChannel.isTextBased()) {
            return siblingTextChannel;
        }
    }

    return null;
}
