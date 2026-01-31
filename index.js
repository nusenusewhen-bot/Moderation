const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ROLE IDS
const ROLE_WARN = "1467183999146528962"; // LOW MOD
const ROLE_KICK = "1467184107594186843"; // MID MOD
const ROLE_BAN  = "1467184373496283348"; // ADMIN

const PREFIX = "+";
const WARN_FILE = "./warns.json";

// LOAD WARNS
let warns = {};
if (fs.existsSync(WARN_FILE)) {
  warns = JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
} else {
  fs.writeFileSync(WARN_FILE, JSON.stringify({}, null, 2));
}

function saveWarns() {
  fs.writeFileSync(WARN_FILE, JSON.stringify(warns, null, 2));
}

// PERMISSION LEVELS
function permLevel(member) {
  if (member.roles.cache.has(ROLE_BAN)) return 3;
  if (member.roles.cache.has(ROLE_KICK)) return 2;
  if (member.roles.cache.has(ROLE_WARN)) return 1;
  return 0;
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const member = message.member;
  const target = message.mentions.members.first();
  const level = permLevel(member);

  // COMMAND LIST (MID+)
  if (cmd === "cmds") {
    if (level < 2) return;
    return message.reply(
`**Commands**
+warn / +warns
+to / +rto
+clearwarn
+kick
+ban
+role
+demo`
    );
  }

  // WARN (LOW+)
  if (cmd === "warn") {
    if (level < 1 || !target) return;

    const id = target.id;
    warns[id] = (warns[id] || 0) + 1;
    saveWarns();

    message.reply(`${target.user.tag} warned. Total warns: ${warns[id]}`);

    if (warns[id] >= 3) {
      const highest = target.roles.highest;
      if (highest && highest.id !== message.guild.id) {
        await target.roles.remove(highest);
        message.channel.send(`${target.user.tag} reached 3 warns. Highest role removed.`);
      }
    }
  }

  // WARNS CHECK (LOW+)
  if (cmd === "warns") {
    if (level < 1 || !target) return;
    message.reply(`${target.user.tag} has ${warns[target.id] || 0} warns.`);
  }

  // CLEAR WARNS (MID+)
  if (cmd === "clearwarn") {
    if (level < 2 || !target) return;
    warns[target.id] = 0;
    saveWarns();
    message.reply(`${target.user.tag}'s warns cleared.`);
  }

  // TIMEOUT / MUTE (LOW+)
  if (cmd === "to") {
    if (level < 1 || !target) return;
    const minutes = parseInt(args[0]);
    if (isNaN(minutes)) return;
    await target.timeout(minutes * 60 * 1000);
    message.reply(`${target.user.tag} muted for ${minutes} minutes.`);
  }

  // REMOVE TIMEOUT (LOW+)
  if (cmd === "rto") {
    if (level < 1 || !target) return;
    await target.timeout(null);
    message.reply(`${target.user.tag} unmuted.`);
  }

  // KICK (MID+)
  if (cmd === "kick") {
    if (level < 2 || !target) return;
    await target.kick();
    message.reply(`${target.user.tag} kicked.`);
  }

  // DEMO (MID+)
  if (cmd === "demo") {
    if (level < 2 || !target) return;
    const highest = target.roles.highest;
    if (highest && highest.id !== message.guild.id) {
      await target.roles.remove(highest);
      message.reply(`Highest role removed from ${target.user.tag}`);
    }
  }

  // BAN (ADMIN)
  if (cmd === "ban") {
    if (level < 3 || !target) return;
    await target.ban();
    message.reply(`${target.user.tag} banned.`);
  }

  // ROLE (ADMIN)
  if (cmd === "role") {
    if (level < 3 || !target) return;
    const role = message.mentions.roles.first();
    if (!role) return;
    await target.roles.add(role);
    message.reply(`Role added to ${target.user.tag}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
