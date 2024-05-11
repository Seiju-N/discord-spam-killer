import {
  Client,
  GatewayIntentBits,
  Partials
} from 'discord.js';
import dotenv from 'dotenv';
import pg from 'pg';


dotenv.config();

const {
  Pool
} = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const spamMap = new Map();

pool.connect()
  .then(() => console.log('Postgres connected'))
  .catch(err => console.error('Postgres connection error', err));

const saveBannedUser = async (userData, reason) => {
  const queryText = `
        INSERT INTO banned_users (
            display_name, nickname, user_id, avatar_hash, ban_date, reason, channel_id, channel_name, message_content
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `;

  const values = [
    userData[0].message.author.tag,
    userData[0].message.member.nickname,
    userData[0].message.author.id,
    userData[0].message.author.avatar,
    new Date().toISOString(),
    reason,
    userData[0].message.channelId,
    userData[0].message.channel.name,
    JSON.stringify(userData.map(entry => ({
      content: entry.message.content,
      time: entry.time,
      channel: entry.message.channelId
    })))
  ];
  try {
    await pool.query(queryText, values);
    console.log(`Saved banned user ${userData[0].message.author.tag}`);
  } catch (err) {
    console.error('Error saving banned user', err);
  }
}

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

  const minAgo = userData.filter(t => now - t.time < 15000);
  spamMap.set(message.author.id, minAgo);

  const uniqueChannels = new Set(minAgo.map(t => t.message.channelId));
  if (uniqueChannels.size >= 3) {
    try {
      // ロールが2つ以上ついている人はBANしない
      if (message.member.roles.cache.size < 2) {
        await message.member.ban({
          deleteMessageSeconds: 60 * 60 * 24 * 3,
          reason: 'Spamming in multiple channels. スパム行為を検知しました。'
        });
        console.log(`Banned ${message.author.tag}`);

        await saveBannedUser(minAgo, 'Spamming in multiple channels');
      }
    } catch (err) {
      console.error(err);
    }

    spamMap.delete(message.author.id);
  }
});

client.login(process.env.DISCORD_TOKEN);
