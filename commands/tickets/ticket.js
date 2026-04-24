import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket commands')
  .addSubcommand(sub => sub.setName('panel').setDescription('Post a ticket panel'))
  .addSubcommand(sub => sub.setName('list').setDescription('List tickets').addStringOption(opt => opt.setName('status').setDescription('Filter by status').addChoices({ name: 'open', value: 'open' }, { name: 'closed', value: 'closed' }, { name: 'archived', value: 'archived' })));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'panel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Admin required', ephemeral: true });
    const embed = new EmbedBuilder().setTitle('📋 Applications & Support').setDescription('Choose the type of request below').setColor(0x5865F2);
    const { TicketPanel } = await import('../../views/ticketViews.js');
    await interaction.reply({ embeds: [embed], components: [TicketPanel()], ephemeral: false });
  } else if (sub === 'list') {
    const cfg = DB.getGuildConfig(interaction.guild.id) || {};
    const supportRole = cfg.support_role;
    const isSupport = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (supportRole && interaction.member.roles.cache.has(String(supportRole)));
    if (!isSupport) return interaction.reply({ content: 'Support role or admin required', ephemeral: true });
    const status = interaction.options.getString('status');
    const tickets = DB.getTickets(interaction.guild.id, status || null);
    if (!tickets || tickets.length === 0) return interaction.reply({ content: 'No tickets found', ephemeral: true });
    const lines = tickets.map(t => `#${t.id} ${t.topic || 'no topic'} (${t.status}) channel:${t.channel_id}`);
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }
}
