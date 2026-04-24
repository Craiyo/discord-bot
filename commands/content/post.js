import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('post')
  .setDescription('Content posting commands')
  .addSubcommand(sc => sc.setName('create').setDescription('Create a post from a template').addStringOption(o => o.setName('template').setDescription('Template name').setRequired(true)))
  .addSubcommand(sc => sc.setName('edit').setDescription('Edit a post by id').addIntegerOption(o => o.setName('id').setDescription('Post id').setRequired(true)))
  .addSubcommand(sc => sc.setName('delete').setDescription('Delete a post by id').addIntegerOption(o => o.setName('id').setDescription('Post id').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'create') {
    const tplName = interaction.options.getString('template');
    const tplPath = path.join(process.cwd(), 'templates', `${tplName}.json`);
    if (!fs.existsSync(tplPath)) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Template not found').setColor(0xff0000)], ephemeral: true });
    const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
    const { buildContentModal } = await import('../../views/contentViews.js');
    const modal = buildContentModal(tpl, null);
    await interaction.showModal(modal);
  } else if (sub === 'edit') {
    const id = interaction.options.getInteger('id');
    const post = DB.getContentPost(id);
    if (!post) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Post not found').setColor(0xff0000)], ephemeral: true });
    // Only admin or original poster
    if (!(interaction.member.permissions.has('Administrator') || String(post.posted_by) === interaction.user.id)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Permission denied').setColor(0xff0000)], ephemeral: true });
    }
    const tplPath = path.join(process.cwd(), 'templates', `${post.template}.json`);
    const tpl = fs.existsSync(tplPath) ? JSON.parse(fs.readFileSync(tplPath, 'utf8')) : { name: post.template, fields: Object.keys(JSON.parse(post.data)) };
    const { buildContentModal } = await import('../../views/contentViews.js');
    const modal = buildContentModal(tpl, post);
    await interaction.showModal(modal);
  } else if (sub === 'delete') {
    const id = interaction.options.getInteger('id');
    const post = DB.getContentPost(id);
    if (!post) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Post not found').setColor(0xff0000)], ephemeral: true });
    if (!(interaction.member.permissions.has('Administrator') || String(post.posted_by) === interaction.user.id)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Permission denied').setColor(0xff0000)], ephemeral: true });
    }
    try {
      const channel = await interaction.guild.channels.fetch(post.channel_id);
      if (channel) {
        const msg = await channel.messages.fetch(post.message_id);
        if (msg) await msg.delete();
      }
    } catch (e) { /* ignore */ }
    DB.deleteContentPost(id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Deleted').setDescription('Post deleted').setColor(0x00ff00)], ephemeral: true });
  }
}
