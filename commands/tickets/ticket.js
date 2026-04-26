import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket commands')
  .addSubcommand(sub => sub.setName('panel').setDescription('Post a ticket panel'))
  .addSubcommand(sub => sub.setName('list').setDescription('List tickets').addStringOption(opt => opt.setName('status').setDescription('Filter by status').addChoices({ name: 'open', value: 'open' }, { name: 'closed', value: 'closed' }, { name: 'archived', value: 'archived' })))
  .addSubcommandGroup(group => {
    group.setName('setup').setDescription('Ticket setup');
    group.addSubcommand(sc => sc.setName('category').setDescription('Set ticket category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)));
    group.addSubcommand(sc => sc.setName('community_category').setDescription('Set community invite category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)));
    group.addSubcommand(sc => sc.setName('guild_app_category').setDescription('Set guild application category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)));
    group.addSubcommand(sc => sc.setName('help_category').setDescription('Set help tickets category').addChannelOption(opt => opt.setName('channel').setDescription('Category').setRequired(true)));
    group.addSubcommand(sc => sc.setName('community_review_role').setDescription('Set community review role').addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)));
    group.addSubcommand(sc => sc.setName('guild_review_role').setDescription('Set guild review role').addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)));
    return group;
  })
  .addSubcommandGroup(group => {
    group.setName('tier').setDescription('Tier role mappings');
    group.addSubcommand(sc => sc.setName('set').setDescription('Map tier to role').addIntegerOption(opt => opt.setName('tier').setDescription('Tier number (1-7)').setRequired(true)).addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true)));
    group.addSubcommand(sc => sc.setName('remove').setDescription('Remove tier role mapping').addIntegerOption(opt => opt.setName('tier').setDescription('Tier number (1-7)').setRequired(true)));
    group.addSubcommand(sc => sc.setName('list').setDescription('List configured tier roles'));
    return group;
  });

export async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // Helper to merge and save only the changed field
  const saveField = (field, value) => {
    const updates = {};
    updates[field] = value;
    DB.setGuildConfig(guildId, updates);
  };

  if (!group) {
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
    return;
  }

  // Groups
  if (group === 'setup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Administrator permission required').setColor(0xff0000)], ephemeral: true });
    }

    if (sub === 'category') {
      const channel = interaction.options.getChannel('channel');
      saveField('ticket_category', channel.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Ticket category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
    } else if (sub === 'community_category') {
      const channel = interaction.options.getChannel('channel');
      saveField('community_category', channel.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Community category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
    } else if (sub === 'guild_app_category') {
      const channel = interaction.options.getChannel('channel');
      saveField('guild_app_category', channel.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Guild application category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
    } else if (sub === 'help_category') {
      const channel = interaction.options.getChannel('channel');
      saveField('help_category', channel.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Help category set to ${channel.name}`).setColor(0x00ff00)], ephemeral: true });
    } else if (sub === 'community_review_role') {
      const role = interaction.options.getRole('role');
      saveField('community_review_role', role.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Community review role set to ${role.name}`).setColor(0x00ff00)], ephemeral: true });
    } else if (sub === 'guild_review_role') {
      const role = interaction.options.getRole('role');
      saveField('guild_review_role', role.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Success').setDescription(`Guild review role set to ${role.name}`).setColor(0x00ff00)], ephemeral: true });
    }
  }

  if (group === 'tier') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Administrator permission required').setColor(0xff0000)], ephemeral: true });
    }

    if (sub === 'set') {
      const tier = interaction.options.getInteger('tier');
      const role = interaction.options.getRole('role');
      if (tier < 1 || tier > 7) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Tier must be between 1 and 7').setColor(0xff0000)], ephemeral: true });
      DB.setTierRole(guildId, tier, role.id);
      return interaction.reply({ content: `Tier ${tier} mapped to ${role}`, ephemeral: true });
    } else if (sub === 'remove') {
      const tier = interaction.options.getInteger('tier');
      if (tier < 1 || tier > 7) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Tier must be between 1 and 7').setColor(0xff0000)], ephemeral: true });
      DB.deleteTierRole(guildId, tier);
      return interaction.reply({ content: `Tier ${tier} mapping removed`, ephemeral: true });
    } else if (sub === 'list') {
      const rows = DB.getAllTierRoles(guildId);
      if (!rows || rows.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Tiers').setDescription('No tier mappings configured').setColor(0xffcc00)], ephemeral: true });
      const embed = new EmbedBuilder().setTitle('Tier Role Mappings').setColor(0x00ff00);
      for (const r of rows) {
        embed.addFields({ name: `Tier ${r.tier_number}`, value: `<@&${r.role_id}>`, inline: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
