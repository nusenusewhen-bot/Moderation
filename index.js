const fs = require("fs");
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

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
const LOG_CHANNEL = "1467212255685906608"; // logging channel

// Load warns
let warns = {};
if (fs.existsSync(WARN_FILE)) {
  warns = JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
} else {
  fs.writeFileSync(WARN_FILE, JSON.stringify({}, null, 2));
}

// Save warns
function saveWarns() {
  fs.writeFileSync(WARN_FILE, JSON.stringify(warns, null, 2));
}

// Permission level
function permLevel(member) {
  if (member.roles.cache.has(ROLE_BAN)) return 3;
  if (member.roles.cache.has(ROLE_KICK)) return 2;
  if (member.roles.cache.has(ROLE_WARN)) return 1;
  return 0;
}

// Role hierarchy check
function canActOn(actor, target) {
  if (!target) return false;
  if (actor.id === target.id) return false;
  return actor.roles.highest.position > target.roles.highest.position;
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Handle button interactions
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, targetId] = interaction.customId.split("_");
  const member = interaction.member;
  if (!interaction.guild) return;

  const target = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!target) return interaction.reply({ content: "Member not found.", ephemeral: true });

  if (!canActOn(member, target)) return interaction.reply({ content: "You cannot unmute this member.", ephemeral: true });

  if (action === "unmute") {
    await target.timeout(null);
    interaction.update({ content: `✅ ${target.user.tag} has been unmuted.`, components: [] });
  }
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
+warn @user [reason] / +warns
+to @user [minutes] / +rto
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
    if (!canActOn(member, target)) return message.reply("You cannot warn this member.");

    const reason = args.filter(a => !a.includes("<@")).join(" ") || "No reason provided";

    const id = target.id;
    warns[id] = (warns[id] || 0) + 1;
    saveWarns();

    // Fetch log channel
    const logChannel = await message.guild.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (logChannel) {
      logChannel.send(
        `**Warn:** ${target.user.tag} warned by ${member.user.tag}\nReason: ${reason}\nTotal warns: ${warns[id]}\nTime: <t:${Math.floor(Date.now()/1000)}:f>`
      );
    }

    // Reset warns at 3
    if (warns[id] >= 3) {
      warns[id] = 0; // reset to 0
      const highest = target.roles.highest;
      if (highest && highest.id !== message.guild.id) {
        await target.roles.remove(highest);
      }
      if (logChannel) {
        logChannel.send(`⚠️ ${target.user.tag} reached 3 warns. Warns reset to 0 and highest role removed.`);
      }
    }

    return message.reply(`${target.user.tag} warned. Total warns: ${warns[id]}`);
  }

  // WARNS CHECK (LOW+)
  if (cmd === "warns") {
    if (level < 1 || !target) return;
    if (!canActOn(member, target)) return message.reply("You cannot view warns of this member.");
    return message.reply(`${target.user.tag} has ${warns[target.id] || 0} warns.`);
  }

  // CLEAR WARNS (MID+)
  if (cmd === "clearwarn") {
    if (level < 2 || !target) return;
    warns[target.id] = 0;
    saveWarns();
    return message.reply(`${target.user.tag}'s warns cleared.`);
  }

  // TIMEOUT / MUTE (LOW+)
  if (cmd === "to") {
    if (level < 1 || !target) return;
    if (!canActOn(member, target)) return message.reply("You cannot mute this member.");

    // Parse minutes after the mention
    const minutesArg = args.find(a => !a.includes("<@") && !isNaN(parseInt(a)));
    if (!minutesArg) return message.reply("Please provide a valid number of minutes.");
    const minutes = parseInt(minutesArg);

    await target.timeout(minutes * 60 * 1000);

    const logChannel = await message.guild.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (logChannel) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`unmute_${target.id}`)
          .setLabel("Remove Mute")
          .setStyle(ButtonStyle.Primary)
      );

      logChannel.send({
        content: `**Mute:** ${target.user.tag} muted by ${member.user.tag}\nDuration: ${minutes} minutes\nTime: <t:${Math.floor(Date.now()/1000)}:f>`,
        components: [row]
      });
    }

    return message.reply(`${target.user.tag} muted for ${minutes} minutes.`);
  }

  // REMOVE TIMEOUT / UNMUTE (LOW+)
  if (cmd === "rto") {
    if (level < 1 || !target) return;
    if (!canActOn(member, target)) return message.reply("You cannot unmute this member.");

    await target.timeout(null);
    return message.reply(`${target.user.tag} unmuted.`);
  }

  // KICK (MID+)
  if (cmd === "kick") {
    if (level < 2 || !target) return;
    if (!canActOn(member, target)) return message.reply("You cannot kick this member.");
    await target.kick();
    return message.reply(`${target.user.tag} kicked.`);
  }

  // DEMO (MID+)
  if (cmd === "demo") {
    if (level < 2 || !target) return;
    if (!canActOn(member, target)) return message.reply("You cannot remove roles from this member.");
    const highest = target.roles.highest;
    if (highest && highest.id !== message.guild.id) {
      await target.roles.remove(highest);
      return message.reply(`Highest role removed from ${target.user.tag}`);
    }
  }

  // BAN (ADMIN)
  if (cmd === "ban") {
    if (level < 3 || !target) return;
    if (!canActOn(member, target)) return message.reply("You cannot ban this member.");
    await target.ban();
    return message.reply(`${target.user.tag} banned.`);
  }

  // ROLE (ADMIN)
  if (cmd === "role") {
    if (level < 3 || !target) return;
    const role = message.mentions.roles.first();
    if (!role) return;
    await target.roles.add(role);
    return message.reply(`Role added to ${target.user.tag}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
