import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('template')
  .setDescription('Raid template management')
  .addSubcommand(sc => sc.setName('create').setDescription('Create a raid template'))
  .addSubcommand(sc => sc.setName('list').setDescription('List templates'))
  .addSubcommand(sc => sc.setName('delete').setDescription('Delete a template').addStringOption(o=>o.setName('name').setDescription('Template name').setRequired(true)))
  .addSubcommand(sc => sc.setName('view').setDescription('View a template').addStringOption(o=>o.setName('name').setDescription('Template name').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === 'create') {
    // show modal
    const modal = new ModalBuilder().setCustomId('raid_template_modal').setTitle('Create Raid Template');
    const name = new TextInputBuilder().setCustomId('name').setLabel('Template Name').setStyle(TextInputStyle.Short).setRequired(true);
    const description = new TextInputBuilder().setCustomId('description').setLabel('Default Description').setStyle(TextInputStyle.Paragraph).setRequired(true);
    const size = new TextInputBuilder().setCustomId('size').setLabel('Total Party Size').setStyle(TextInputStyle.Short).setRequired(true);
    const roles = new TextInputBuilder().setCustomId('roles').setLabel('Roles (RoleName:Count, one per line)').setStyle(TextInputStyle.Paragraph).setRequired(true);
    const note = new TextInputBuilder().setCustomId('note').setLabel('Note (optional)').setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(name), new ActionRowBuilder().addComponents(description), new ActionRowBuilder().addComponents(size), new ActionRowBuilder().addComponents(roles), new ActionRowBuilder().addComponents(note));
    return interaction.showModal(modal);
  }

  if (sub === 'list') {
    const rows = DB.getAllRaidTemplates(guildId);
    if (!rows || rows.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Templates').setDescription('No templates configured').setColor(0xffcc00)], ephemeral: true });
    const embed = new EmbedBuilder().setTitle('Raid Templates').setColor(0x00ff00);
    for (const r of rows) {
      let roles = 'N/A';
      try { roles = JSON.parse(r.roles).map(x=>`${x.name}:${x.count}`).join(', '); } catch(e){}
      embed.addFields({ name: `${r.name} — ${r.size} players`, value: `${roles}\nCreated by: <@${r.created_by}>`, inline: false });
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'delete') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Admin required', ephemeral: true });
    const name = interaction.options.getString('name');
    DB.deleteRaidTemplate(guildId, name);
    return interaction.reply({ content: `Template ${name} deleted`, ephemeral: true });
  }

  if (sub === 'view') {
    const name = interaction.options.getString('name');
    const tpl = DB.getRaidTemplate(guildId, name);
    if (!tpl) return interaction.reply({ content: 'Template not found', ephemeral: true });
    const embed = new EmbedBuilder().setTitle(`Template: ${tpl.name}`).setDescription(tpl.description).setColor(0x00ff00);
    try {
      const roles = JSON.parse(tpl.roles);
      embed.addFields(...roles.map(r=>({ name: `${r.name}`, value: `Count: ${r.count}`, inline: true })));
    } catch(e){}
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
