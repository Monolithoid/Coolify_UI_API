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

let shutdownTimeout = null;

client.on("ready", function handleReady() {
    console.log("Bot connecté en tant que", client.user.tag);
});

client.on("voiceStateUpdate", async function handleVoiceState(oldState, newState) {
    const channelId = process.env.DISCORD_VOICE_CHANNEL_ID;

    const userJoined = newState.channelId === channelId && oldState.channelId !== channelId;
    const userLeft = oldState.channelId === channelId && newState.channelId !== channelId;

    if (userJoined) {
        await requestStart();
        clearPendingShutdown();
    }

    if (userLeft) {
        scheduleShutdownIfEmpty(newState.guild, channelId);
    }
});

client.login(process.env.DISCORD_TOKEN);

async function requestStart() {
    try {
        await axios.post(process.env.API_BASE_URL + "/start");
        console.log("Démarrage demandé depuis Discord");
    } catch (error) {
        console.error("Échec du démarrage", error.message);
    }
}

function scheduleShutdownIfEmpty(guild, channelId) {
    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
        return;
    }

    const hasMembers = channel.members.size > 0;

    if (hasMembers) {
        return;
    }

    clearPendingShutdown();

    shutdownTimeout = setTimeout(function handleShutdownTimer() {
        requestStop();
    }, 10 * 60 * 1000);
}

function clearPendingShutdown() {
    if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
    }
}

async function requestStop() {
    try {
        await axios.post(process.env.API_BASE_URL + "/stop");
        console.log("Arrêt demandé depuis Discord");
    } catch (error) {
        console.error("Échec de l'arrêt", error.message);
    }
}
