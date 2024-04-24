import {
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const spamMap = new Map();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const now = Date.now();
    const userData = spamMap.get(message.author.id) || [];
    userData.push({
        channel: message.channelId,
        messageId: message.id,
        time: now
    });

    const minAgo = userData.filter(t => now - t.time < 60000);
    spamMap.set(message.author.id, minAgo);

    const uniqueChannels = new Set(minAgo.map(t => t.channel));
    if (uniqueChannels.size >= 4) {
        const messagesToDelete = [];
        minAgo.forEach(entry => {
            const channel = client.channels.cache.get(entry.channel);
            if (channel && channel.type === ChannelType.GuildText) {
                messagesToDelete.push(channel.messages.fetch(entry.messageId));
            }
        });

        try {
            const fetchedMessages = await Promise.all(messagesToDelete);
            fetchedMessages.forEach(msg => {
                if (msg) msg.delete().catch(console.error);
            });

            await message.member.ban("Spamming");
            console.log(`Banned ${message.author.tag}`);
        } catch (err) {
            console.error(err);
        }

        spamMap.delete(message.author.id);
    }
});


client.login(process.env.DISCORD_TOKEN);
