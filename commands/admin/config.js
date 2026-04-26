// setup.js has been replaced by config.js, tickets/ticket.js, and raid/raid.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Server config commands')
  .addSubcommand(sub => sub.setName('log_channel').setDescription('Set audit log channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)))
  .addSubcommand(sub => sub.setName('support_role').setDescription('Set support role').addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)));

export async function execute(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Administrator permission required').setColor(0xff0000)], ephemeral: true });
  }
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  const saveField = (field, value) => {
    const updates = {};
    updates[field] = value;
    DB.setGuildConfig(guildId, updates);
  };

  if (sub === 'log_channel') {
    const channel = interaction.options.getChannel('channel');
    saveField('log_channel', channel.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Log channel set to ${channel}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'support_role') {
    const role = interaction.options.getRole('role');
    saveField('support_role', role.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Support role set to ${role.name}`).setColor(0x00ff00)], ephemeral: true });
  }
}
