import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function TicketPanel() {
  const btnCommunity = new ButtonBuilder().setCustomId('ticket_community').setLabel('🌍 Community').setStyle(ButtonStyle.Primary);
  const btnGuild = new ButtonBuilder().setCustomId('ticket_guild').setLabel('⚔️ Guild').setStyle(ButtonStyle.Primary);
  const btnHelp = new ButtonBuilder().setCustomId('ticket_help').setLabel('🆘 Help').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(btnCommunity, btnGuild, btnHelp);
  return row;
}

export function CommunityModal() {
  const modal = new ModalBuilder().setCustomId('community_modal').setTitle('Community Application');
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
  const fame = new TextInputBuilder().setCustomId('fame').setLabel('PVE Fame / PVP Fame (e.g. 1M/500K)').setStyle(TextInputStyle.Short).setRequired(true);
  const weapon = new TextInputBuilder().setCustomId('weapon').setLabel('Primary Weapon').setStyle(TextInputStyle.Short).setRequired(true);
  const can_vc = new TextInputBuilder().setCustomId('can_vc').setLabel('Can Join VC? (yes/no)').setStyle(TextInputStyle.Short).setRequired(true);
  const open_mic = new TextInputBuilder().setCustomId('open_mic').setLabel('Open Mic? (yes/no)').setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(ign), new ActionRowBuilder().addComponents(fame), new ActionRowBuilder().addComponents(weapon), new ActionRowBuilder().addComponents(can_vc), new ActionRowBuilder().addComponents(open_mic));
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

export function helpActionRow(ticketId) {
  const close = new ButtonBuilder().setCustomId(`help_close_${ticketId}`).setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger);
  return new ActionRowBuilder().addComponents(close);
}
