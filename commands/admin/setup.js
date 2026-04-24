import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Server setup commands')
  .addSubcommand(sub => sub.setName('log_channel').setDescription('Set audit log channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)))
  .addSubcommand(sub => sub.setName('ticket_category').setDescription('Set ticket category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)))
  .addSubcommand(sub => sub.setName('support_role').setDescription('Set support role').addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)))
  .addSubcommand(sub => sub.setName('community_category').setDescription('Set community invite category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)))
  .addSubcommand(sub => sub.setName('guild_app_category').setDescription('Set guild application category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)))
  .addSubcommand(sub => sub.setName('help_category').setDescription('Set help tickets category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)))
  .addSubcommand(sub => sub.setName('community_review_role').setDescription('Set community review role').addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)))
  .addSubcommand(sub => sub.setName('guild_review_role').setDescription('Set guild review role').addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)))
  .addSubcommand(sub => sub.setName('tier_role').setDescription('Map tier to role').addIntegerOption(opt => opt.setName('tier').setDescription('Tier number (1-7)').setRequired(true)).addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true)))
  .addSubcommand(sub => sub.setName('tier_role_remove').setDescription('Remove tier role mapping').addIntegerOption(opt => opt.setName('tier').setDescription('Tier number (1-7)').setRequired(true)))
  .addSubcommand(sub => sub.setName('tier_roles_list').setDescription('List configured tier roles'))
  .addSubcommand(sub => sub.setName('raid_channel_add').setDescription('Register a raid channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)).addStringOption(opt => opt.setName('type').setDescription('Channel type').addChoices({ name: 'raid', value: 'raid' }, { name: 'basic', value: 'basic' }).setRequired(true)).addStringOption(opt => opt.setName('label').setDescription('Label/Name').setRequired(true)))
  .addSubcommand(sub => sub.setName('raid_channel_remove').setDescription('Remove a registered raid channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)))
  .addSubcommand(sub => sub.setName('raid_channels_list').setDescription('List registered raid channels'));

export async function execute(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Administrator permission required').setColor(0xff0000)], ephemeral: true });
  }
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const existing = DB.getGuildConfig(guildId) || {};

  // Helper to merge and save only the changed field
  const saveField = (field, value) => {
    const updates = {};
    updates[field] = value;
    DB.setGuildConfig(guildId, updates);
  };

  if (sub === 'log_channel') {
    const channel = interaction.options.getChannel('channel');
    saveField('log_channel', channel.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Log channel set to ${channel}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'ticket_category') {
    const channel = interaction.options.getChannel('channel');
    saveField('ticket_category', channel.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Ticket category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'support_role') {
    const role = interaction.options.getRole('role');
    saveField('support_role', role.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Support role set to ${role.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'community_category') {
    const channel = interaction.options.getChannel('channel');
    saveField('community_category', channel.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Community category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'guild_app_category') {
    const channel = interaction.options.getChannel('channel');
    saveField('guild_app_category', channel.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Guild application category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'help_category') {
    const channel = interaction.options.getChannel('channel');
    saveField('help_category', channel.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Help category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'community_review_role') {
    const role = interaction.options.getRole('role');
    saveField('community_review_role', role.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Community review role set to ${role.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'guild_review_role') {
    const role = interaction.options.getRole('role');
    saveField('guild_review_role', role.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Guild review role set to ${role.name}`).setColor(0x00ff00)], ephemeral: true });
  } else if (sub === 'tier_role') {
    const tier = interaction.options.getInteger('tier');
    const role = interaction.options.getRole('role');
    if (tier < 1 || tier > 7) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Tier must be between 1 and 7').setColor(0xff0000)], ephemeral: true });
    DB.setTierRole(guildId, tier, role.id);
    await interaction.reply({ content: `Tier ${tier} mapped to ${role}`, ephemeral: true });
  } else if (sub === 'tier_role_remove') {
    const tier = interaction.options.getInteger('tier');
    if (tier < 1 || tier > 7) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Tier must be between 1 and 7').setColor(0xff0000)], ephemeral: true });
    DB.deleteTierRole(guildId, tier);
    await interaction.reply({ content: `Tier ${tier} mapping removed`, ephemeral: true });
  } else if (sub === 'tier_roles_list') {
    const rows = DB.getAllTierRoles(guildId);
    if (!rows || rows.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Tiers').setDescription('No tier mappings configured').setColor(0xffcc00)], ephemeral: true });
    const embed = new EmbedBuilder().setTitle('Tier Role Mappings').setColor(0x00ff00);
    for (const r of rows) {
      embed.addFields({ name: `Tier ${r.tier_number}`, value: `<@&${r.role_id}>`, inline: true });
    }
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (sub === 'raid_channel_add') {
    const channel = interaction.options.getChannel('channel');
    const type = interaction.options.getString('type');
    const label = interaction.options.getString('label');
    DB.addRaidChannel(guildId, channel.id, type, label);
    await interaction.reply({ content: `Channel ${channel} registered as ${type} — ${label}`, ephemeral: true });
  } else if (sub === 'raid_channel_remove') {
    const channel = interaction.options.getChannel('channel');
    DB.removeRaidChannel(guildId, channel.id);
    await interaction.reply({ content: `Channel ${channel} removed`, ephemeral: true });
  } else if (sub === 'raid_channels_list') {
    const rows = DB.getAllRaidChannels(guildId);
    if (!rows || rows.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Raid Channels').setDescription('No raid channels registered').setColor(0xffcc00)], ephemeral: true });
    const embed = new EmbedBuilder().setTitle('Raid Channels').setColor(0x00ff00);
    for (const r of rows) embed.addFields({ name: r.label || `${r.channel_id}`, value: `<#${r.channel_id}> — ${r.channel_type}`, inline: false });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
