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
const ROLE_WARN = "1467183999146528962";
const ROLE_KICK = "1467184107594186843";
const ROLE_BAN  = "1467184373496283348";

const PREFIX = "$";
const WARN_FILE = "./warns.json";

// Load warns safely
let warns = {};
if (fs.existsSync(WARN_FILE)) {
  warns = JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
} else {
  fs.writeFileSync(WARN_FILE, JSON.stringify({}, null, 2));
}

// Save warns function
function saveWarns() {
  fs.writeFileSync(WARN_FILE, JSON.stringify(warns, null, 2));
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

  const hasRole = (id) => member.roles.cache.has(id);

  // COMMAND LIST
  if (cmd === "cmds") {
    if (!hasRole(ROLE_WARN)) return;
    return message.reply(
`**Commands**
$warn @user – warn user
$warns @user – check warns
$clearwarn @user – reset warns
$kick @user – kick user
$ban @user – ban user
$role @user (role) – give role
$demo @user – remove highest role
$to @user (minutes) – timeout user
$rto @user – remove timeout`
    );
  }

  // WARN
  if (cmd === "warn") {
    if (!hasRole(ROLE_WARN) || !target) return;

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

  // WARNS CHECK
  if (cmd === "warns") {
    if (!hasRole(ROLE_WARN) || !target) return;
    message.reply(`${target.user.tag} has ${warns[target.id] || 0} warns.`);
  }

  // CLEAR WARNS
  if (cmd === "clearwarn") {
    if (!hasRole(ROLE_WARN) || !target) return;
    warns[target.id] = 0;
    saveWarns();
    message.reply(`${target.user.tag}'s warns cleared.`);
  }

  // KICK
  if (cmd === "kick") {
    if (!hasRole(ROLE_KICK) || !target) return;
    await target.kick();
    message.reply(`${target.user.tag} kicked.`);
  }

  // BAN
  if (cmd === "ban") {
    if (!hasRole(ROLE_BAN) || !target) return;
    await target.ban();
    message.reply(`${target.user.tag} banned.`);
  }

  // ROLE
  if (cmd === "role") {
    if (!hasRole(ROLE_WARN) || !target) return;
    const role = message.mentions.roles.first();
    if (!role) return;
    await target.roles.add(role);
    message.reply(`Role added to ${target.user.tag}`);
  }

  // DEMO
  if (cmd === "demo") {
    if (!hasRole(ROLE_KICK) || !target) return;
    const highest = target.roles.highest;
    if (highest && highest.id !== message.guild.id) {
      await target.roles.remove(highest);
      message.reply(`Highest role removed from ${target.user.tag}`);
    }
  }

  // TIMEOUT
  if (cmd === "to") {
    if (!hasRole(ROLE_WARN) || !target) return;
    const minutes = parseInt(args[0]);
    if (isNaN(minutes)) return;
    await target.timeout(minutes * 60 * 1000);
    message.reply(`${target.user.tag} timed out for ${minutes} minutes.`);
  }

  // REMOVE TIMEOUT
  if (cmd === "rto") {
    if (!hasRole(ROLE_WARN) || !target) return;
    await target.timeout(null);
    message.reply(`Timeout removed for ${target.user.tag}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
