import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DB } from '../../db.js';

// In-memory timers map (shared via import by events when needed)
export const raidPingTimers = new Map();

export function buildRaidEmbed(party) {
  const embed = new EmbedBuilder().setTitle(party.title).setDescription(party.description || '').setFooter({ text: `Start Time: ${party.start_time} | Hosted by ${party.host_id ? `<@${party.host_id}>` : 'unknown'} | Party ID: ${party.id}` });
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
    const name = r.name;
    const count = Number(r.count) || 0;
    const filled = (members[name] || []).length;
    const fieldName = `⚔️ ${name} (${filled}/${count})`;
    const value = (members[name] && members[name].length>0) ? members[name].map(id=>`<@${id}>`).join('\n') : 'Empty';
    embed.addFields({ name: fieldName, value, inline: false });

    const btn = new ButtonBuilder().setCustomId(`raid_join_${party.id}_${encodeURIComponent(name)}`).setLabel(name);
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
  .addSubcommand(sub => sub.setName('kick').setDescription('Kick a member from a party').addIntegerOption(o=>o.setName('id').setDescription('Party ID').setRequired(true)).addUserOption(o=>o.setName('user').setDescription('User to kick').setRequired(true)));

export async function execute(interaction) {
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
