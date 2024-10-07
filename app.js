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
    message: message,
    time: now
  });

  const minAgo = userData.filter(t => now - t.time < 12000);
  spamMap.set(message.author.id, minAgo);

  const uniqueChannels = new Set(minAgo.map(t => t.message.channelId));

  // Count messages per channel
  const channelMessageCounts = new Map();
  minAgo.forEach(entry => {
    const count = channelMessageCounts.get(entry.message.channelId) || 0;
    channelMessageCounts.set(entry.message.channelId, count + 1);
  });

  // Check for long messages or URLs
  const isLongOrContainsURL = (msg) => msg.content.length > 300 || /(https?:\/\/[^\s]+)/g.test(msg.content);

  const longOrURLMessages = minAgo.filter(entry => isLongOrContainsURL(entry.message));
  const longOrURLSpam = longOrURLMessages.length >= 3;

  if (uniqueChannels.size >= 3 || longOrURLSpam) {
    try {
      // Do not ban users with 2 or more roles
      if (message.member.roles.cache.size < 2) {
        await message.member.ban({
          deleteMessageSeconds: 259200, // 3 days
          reason: 'Spamming. スパム行為を検知しました。'
        });
        console.log(`Banned ${message.author.tag}`);
      }
    } catch (err) {
      console.error(err);
    }

    spamMap.delete(message.author.id);
  }
});

console.log(process.env.DISCORD_TOKEN);
client.login(process.env.DISCORD_TOKEN);
