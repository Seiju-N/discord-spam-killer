import {
    Client,
    GatewayIntentBits,
    Partials
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
        time: now
    });

    const minAgo = userData.filter(t => now - t.time < 20000);
    spamMap.set(message.author.id, minAgo);

    const uniqueChannels = new Set(minAgo.map(t => t.channel));
    if (uniqueChannels.size >= 4) {
        try {
            // ロールが2つ以上ついている人はBANしない
            if (message.member.roles.cache.size < 2) {
                await message.member.ban({
                    deleteMessageSeconds: 60 * 60 * 24 * 3,
                    reason: 'Spamming in multiple channels. スパム行為を検知しました。'
                });
                console.log(`Banned ${message.author.tag}`);
            }
        } catch (err) {
            console.error(err);
        }

        spamMap.delete(message.author.id);
    }
});


client.login(process.env.DISCORD_TOKEN);
