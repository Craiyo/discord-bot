import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('logs')
  .setDescription('Show logs for a user')
  .addUserOption(opt => opt.setName('user').setDescription('User to query').setRequired(true))
  .addIntegerOption(opt => opt.setName('limit').setDescription('Number of entries').setRequired(false));

function makeEmbedForEntries(entries, index) {
  const e = new EmbedBuilder().setTitle('Audit Logs').setColor(0x3498db);
  const page = entries.slice(index * 5, index * 5 + 5);
  for (const r of page) {
    e.addFields({ name: `${r.event_type} (ID:${r.id})`, value: `${r.detail}\n${r.timestamp}` });
  }
  e.setFooter({ text: `Page ${index + 1}/${Math.ceil(entries.length / 5)}` });
  return e;
}

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const limit = interaction.options.getInteger('limit') || 20;
  const entries = DB.getAuditLogsForUser(interaction.guild.id, user.id, limit);
  if (!entries || entries.length === 0) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('No logs').setDescription('No entries found').setColor(0xffcc00)], ephemeral: true });
  }
  let page = 0;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('logs_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('logs_next').setLabel('Next').setStyle(ButtonStyle.Secondary)
  );
  await interaction.reply({ embeds: [makeEmbedForEntries(entries, page)], components: [row], ephemeral: true });
  const msg = await interaction.fetchReply();
  const collector = msg.createMessageComponentCollector({ time: 120000 });
  collector.on('collect', i => {
    if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not for you', ephemeral: true });
    if (i.customId === 'logs_prev') page = Math.max(0, page - 1);
    if (i.customId === 'logs_next') page = Math.min(Math.ceil(entries.length / 5) - 1, page + 1);
    i.update({ embeds: [makeEmbedForEntries(entries, page)] });
  });
}
