import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function buildContentModal(template, existingPost=null) {
  const modal = new ModalBuilder().setCustomId(`content_modal_${template.name}`).setTitle(`Create: ${template.name}`);
  for (const fld of template.fields) {
    const input = new TextInputBuilder().setCustomId(fld).setLabel(fld).setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(existingPost ? (JSON.parse(existingPost.data)[fld] || '') : '');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}
