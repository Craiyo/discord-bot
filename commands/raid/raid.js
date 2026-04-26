import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DB } from '../../db.js';

// In-memory timers map (shared via import by events when needed)
export const raidPingTimers = new Map();

export function buildRaidEmbed(party) {
  const titleText = (party.title && String(party.title).trim().length>0) ? String(party.title) : 'Raid Party';
  const embed = new EmbedBuilder().setTitle(titleText);
  if (party.description && String(party.description).trim().length>0) embed.setDescription(String(party.description));
  const footerText = `Start Time: ${party.start_time || 'TBD'} | Hosted by ${party.host_id ? `<@${party.host_id}>` : 'unknown'} | Party ID: ${party.id}`;
  embed.setFooter({ text: footerText });

  let color = 0x2ecc71;
  if (party.status === 'full') color = 0xe74c3c;
  if (party.status === 'closed') color = 0x95a5a6;
  embed.setColor(color);

  let roles = [];
  try { roles = JSON.parse(party.roles); } catch (e) { roles = []; }
  let members = {};
  try { members = JSON.parse(party.members); } catch (e) { members = {}; }

  const components = [];
  const roleButtons = [];
  for (const r of roles) {
    const name = r.name || 'Role';
    const count = Number(r.count) || 0;
    const filled = (members[name] || []).length;
    const fieldName = `⚔️ ${name} (${filled}/${count})`;
    const value = (members[name] && members[name].length>0) ? members[name].map(id=>`<@${id}>`).join('\n') : 'Empty';
    // only add fields with non-empty name and value
    if (String(fieldName).trim().length>0 && String(value).trim().length>0) embed.addFields({ name: fieldName, value, inline: false });

    const btn = new ButtonBuilder().setCustomId(`raid_join_${party.id}_${encodeURIComponent(name)}`).setLabel(name.length>80?name.slice(0,77)+"...":name);
    if (party.status === 'closed') btn.setDisabled(true).setStyle(ButtonStyle.Secondary);
    else btn.setStyle(filled >= count ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(filled >= count || party.status === 'closed');

    roleButtons.push(btn);
  }

  // split roleButtons into rows of max 5
  for (let i=0;i<roleButtons.length;i+=5) {
    const row = new ActionRowBuilder().addComponents(...roleButtons.slice(i,i+5));
    components.push(row);
  }

  // final control row: Leave and Close
  const leave = new ButtonBuilder().setCustomId(`raid_leave_${party.id}`).setLabel('🚪 Leave').setStyle(ButtonStyle.Secondary).setDisabled(party.status === 'closed');
  const close = new ButtonBuilder().setCustomId(`raid_close_${party.id}`).setLabel('❌ Close').setStyle(ButtonStyle.Danger).setDisabled(party.status === 'closed');
  const controlRow = new ActionRowBuilder().addComponents(leave, close);
  components.push(controlRow);

  return { embeds: [embed], components };
}

export const data = new SlashCommandBuilder()
  .setName('raid')
  .setDescription('Raid party commands')
  .addSubcommand(sub => sub.setName('create').setDescription('Create a raid party'))
  .addSubcommand(sub => sub.setName('close').setDescription('Close a raid party').addIntegerOption(o=>o.setName('id').setDescription('Party ID').setRequired(true)))
  .addSubcommand(sub => sub.setName('kick').setDescription('Kick a member from a party').addIntegerOption(o=>o.setName('id').setDescription('Party ID').setRequired(true)).addUserOption(o=>o.setName('user').setDescription('User to kick').setRequired(true)))
  .addSubcommandGroup(group => group.setName('setup').setDescription('Raid setup')
    .addSubcommand(sc => sc.setName('add').setDescription('Register a raid channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)).addStringOption(opt => opt.setName('type').setDescription('Channel type').addChoices({ name: 'raid', value: 'raid' }, { name: 'basic', value: 'basic' }).setRequired(true)).addStringOption(opt => opt.setName('label').setDescription('Label/Name').setRequired(true)))
    .addSubcommand(sc => sc.setName('remove').setDescription('Remove a registered raid channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(sc => sc.setName('list').setDescription('List registered raid channels')));

export async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  if (group === 'setup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Administrator permission required').setColor(0xff0000)], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const channel = interaction.options.getChannel('channel');
      const type = interaction.options.getString('type');
      const label = interaction.options.getString('label');
      DB.addRaidChannel(guildId, channel.id, type, label);
      return interaction.reply({ content: `Channel ${channel} registered as ${type} — ${label}`, ephemeral: true });
    } else if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      DB.removeRaidChannel(interaction.guild.id, channel.id);
      return interaction.reply({ content: `Channel ${channel} removed`, ephemeral: true });
    } else if (sub === 'list') {
      const rows = DB.getAllRaidChannels(interaction.guild.id);
      if (!rows || rows.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Raid Channels').setDescription('No raid channels registered').setColor(0xffcc00)], ephemeral: true });
      const embed = new EmbedBuilder().setTitle('Raid Channels').setColor(0x00ff00);
      for (const r of rows) embed.addFields({ name: r.label || `${r.channel_id}`, value: `<#${r.channel_id}> — ${r.channel_type}`, inline: false });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'create') {
    // show modal
    const modal = new ModalBuilder().setCustomId('raid_create_modal').setTitle('Create Raid Party');
    const title = new TextInputBuilder().setCustomId('title').setLabel('Party Title').setStyle(TextInputStyle.Short).setRequired(true);
    const template = new TextInputBuilder().setCustomId('template').setLabel('Template Name (leave blank for custom)').setStyle(TextInputStyle.Short).setRequired(false);
    const size = new TextInputBuilder().setCustomId('size').setLabel('Party Size (ignored if template used)').setStyle(TextInputStyle.Short).setRequired(false);
    const roles = new TextInputBuilder().setCustomId('roles').setLabel('Roles (Role:Count, one per line)').setStyle(TextInputStyle.Paragraph).setRequired(false);
    const start_time = new TextInputBuilder().setCustomId('start_time').setLabel('Start Time (e.g. 21:00 UTC)').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(title), new ActionRowBuilder().addComponents(template), new ActionRowBuilder().addComponents(size), new ActionRowBuilder().addComponents(roles), new ActionRowBuilder().addComponents(start_time));
    return interaction.showModal(modal);
  }

  if (sub === 'close') {
    const id = interaction.options.getInteger('id');
    const party = DB.getRaidPartyById(id);
    if (!party) return interaction.reply({ content: 'Party not found', ephemeral: true });
    if (String(party.host_id) !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Only host or admin can close', ephemeral: true });
    DB.updateRaidParty(id, party.members, 'closed');
    // edit message to disabled
    try {
      const channel = await interaction.guild.channels.fetch(party.channel_id).catch(()=>null);
      if (channel && party.message_id) {
        const msg = await channel.messages.fetch(party.message_id).catch(()=>null);
        if (msg) {
          const { buildRaidEmbed } = await import('./raid.js');
          const updated = buildRaidEmbed(Object.assign({}, party, { status: 'closed' }));
          await msg.edit(updated).catch(()=>{});
        }
      }
    } catch (e) {}
    raidPingTimers.delete(String(id));
    return interaction.reply({ content: 'Party closed', ephemeral: true });
  }

  if (sub === 'kick') {
    const id = interaction.options.getInteger('id');
    const user = interaction.options.getUser('user');
    const party = DB.getRaidPartyById(id);
    if (!party) return interaction.reply({ content: 'Party not found', ephemeral: true });
    if (String(party.host_id) !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Only host or admin can kick', ephemeral: true });
    let members = {};
    try { members = JSON.parse(party.members); } catch (e) { members = {}; }
    let removed = false;
    for (const roleName of Object.keys(members)) {
      const arr = members[roleName];
      const idx = arr.indexOf(String(user.id));
      if (idx !== -1) { arr.splice(idx,1); removed = true; break; }
    }
    if (!removed) return interaction.reply({ content: 'User not found in party', ephemeral: true });
    DB.updateRaidParty(id, JSON.stringify(members), 'open');
    // edit message
    try {
      const channel = await interaction.guild.channels.fetch(party.channel_id).catch(()=>null);
      if (channel && party.message_id) {
        const msg = await channel.messages.fetch(party.message_id).catch(()=>null);
        if (msg) {
          const { buildRaidEmbed } = await import('./raid.js');
          const updated = buildRaidEmbed(Object.assign({}, party, { members: JSON.stringify(members), status: 'open' }));
          await msg.edit(updated).catch(()=>{});
        }
      }
    } catch (e) {}
    try {
      const mem = await interaction.guild.members.fetch(user.id).catch(()=>null);
      if (mem) await mem.send(`You have been removed from raid party ${party.title} by the host`).catch(()=>{});
    } catch (e) {}
    return interaction.reply({ content: `Kicked ${user.tag}`, ephemeral: true });
  }
}
