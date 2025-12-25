import { Client, GatewayIntentBits } from "discord.js";
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

client.on("ready", function handleReady() {
    console.log("Bot connecté en tant que", client.user.tag);
});

client.on("voiceStateUpdate", async function handleVoiceState(oldState, newState) {
    const previousChannelId = oldState.channelId;
    const nextChannelId = newState.channelId;

    const joinedContext = resolveContext(nextChannelId);
    const leftContext = resolveContext(previousChannelId);

    if (joinedContext) {
        await requestStart(joinedContext);
        clearPendingShutdown(joinedContext.channelKey);
    }

    if (leftContext) {
        scheduleShutdownIfEmpty(newState.guild, leftContext);
    }
});

client.login(process.env.DISCORD_TOKEN);

async function requestStart(context) {
    const endpoint = context.apiBaseUrl + "/api/server/" + context.gameId + "/start";

    try {
        await axios.post(endpoint);
        console.log("Démarrage demandé pour", context.gameId);
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
        requestStop(context);
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

async function requestStop(context) {
    const endpoint = context.apiBaseUrl + "/api/server/" + context.gameId + "/stop";

    try {
        await axios.post(endpoint);
        console.log("Arrêt demandé pour", context.gameId);
    } catch (error) {
        console.error("Échec de l'arrêt pour", context.gameId, error.message);
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
            apiBaseUrl: mapping.apiBaseUrl || process.env.API_BASE_URL
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
        apiBaseUrl: process.env.API_BASE_URL
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
                    apiBaseUrl: entry.apiBaseUrl
                };
            });
        }

        return [];
    } catch (error) {
        console.error("Impossible de parser DISCORD_GAME_CHANNEL_MAPPINGS", error.message);
        return [];
    }
}
