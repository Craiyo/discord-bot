import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function TicketPanel() {
  const btnCommunity = new ButtonBuilder().setCustomId('ticket_community').setLabel('🌍 Community Invite').setStyle(ButtonStyle.Primary);
  const btnGuild = new ButtonBuilder().setCustomId('ticket_guild').setLabel('⚔️ Guild Application').setStyle(ButtonStyle.Primary);
  const btnHelp = new ButtonBuilder().setCustomId('ticket_help').setLabel('🆘 Help').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(btnCommunity, btnGuild, btnHelp);
  return row;
}

export function CommunityModal() {
  const modal = new ModalBuilder().setCustomId('community_modal').setTitle('Community Invite Application');
  const ign = new TextInputBuilder().setCustomId('ign').setLabel('In-Game Name (IGN)').setStyle(TextInputStyle.Short).setRequired(true);
  const breci = new TextInputBuilder().setCustomId('breci').setLabel('Brecilien Unlocked? (yes/no)').setStyle(TextInputStyle.Short).setRequired(true);
  const can_vc = new TextInputBuilder().setCustomId('can_vc').setLabel('Can Join VC? (yes/no)').setStyle(TextInputStyle.Short).setRequired(true);
  const open_mic = new TextInputBuilder().setCustomId('open_mic').setLabel('Open Mic? (yes/no)').setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(ign), new ActionRowBuilder().addComponents(breci), new ActionRowBuilder().addComponents(can_vc), new ActionRowBuilder().addComponents(open_mic));
  return modal;
}

export function GuildModal() {
  const modal = new ModalBuilder().setCustomId('guild_modal').setTitle('Guild Application');
  const ign = new TextInputBuilder().setCustomId('ign').setLabel('In-Game Name (IGN)').setStyle(TextInputStyle.Short).setRequired(true);
  const pve = new TextInputBuilder().setCustomId('pve_fame').setLabel('PVE Fame (number)').setStyle(TextInputStyle.Short).setRequired(true);
  const pvp = new TextInputBuilder().setCustomId('pvp_fame').setLabel('PVP Fame (number)').setStyle(TextInputStyle.Short).setRequired(true);
  const weapon = new TextInputBuilder().setCustomId('primary_weapon').setLabel('Primary Weapon').setStyle(TextInputStyle.Short).setRequired(true);
  const vc_mic = new TextInputBuilder().setCustomId('vc_mic').setLabel('Can Join VC / Open Mic? (e.g. yes/no)').setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(ign), new ActionRowBuilder().addComponents(pve), new ActionRowBuilder().addComponents(pvp), new ActionRowBuilder().addComponents(weapon), new ActionRowBuilder().addComponents(vc_mic));
  return modal;
}

export function HelpModal() {
  const modal = new ModalBuilder().setCustomId('help_modal').setTitle('Help Request');
  const issue = new TextInputBuilder().setCustomId('issue').setLabel('Describe your issue').setStyle(TextInputStyle.Paragraph).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(issue));
  return modal;
}

export function ticketActionRow(ticketId) {
  const close = new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Danger);
  const archive = new ButtonBuilder().setCustomId(`ticket_archive_${ticketId}`).setLabel('Archive').setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(close, archive);
  return row;
}
