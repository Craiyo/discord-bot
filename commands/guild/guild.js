import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { DB } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('guild')
  .setDescription('Guild application management')
  .addSubcommand(sub => sub
    .setName('approve')
    .setDescription('Approve a guild application')
    .addUserOption(opt => opt.setName('user').setDescription('Applicant').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('reject')
    .setDescription('Reject a guild application')
    .addUserOption(opt => opt.setName('user').setDescription('Applicant').setRequired(true)));

// Helper: generate transcript attachment
export async function generateTranscript(channel, ticket) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const ordered = Array.from(messages.values()).reverse();
    const lines = ordered.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`);
    const content = lines.join('\n');
    const filename = `transcript-${channel.name}-${new Date().toISOString().slice(0,10)}.txt`;
    const buffer = Buffer.from(content, 'utf8');
    const attachment = new AttachmentBuilder(buffer, { name: filename });
    return attachment;
  } catch (e) {
    console.error('generateTranscript error', e);
    return null;
  }
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const cfg = DB.getGuildConfig(guildId) || {};

  // Must be used inside a ticket channel
  const ticket = DB.getTicketByChannelId(interaction.channelId || interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'This command must be used inside a ticket channel', ephemeral: true });
  if (ticket.topic !== 'guild') return interaction.reply({ content: 'This command can only be used in guild application tickets', ephemeral: true });

  // Permission check
  const member = interaction.member;
  const hasRole = cfg.guild_review_role && member.roles.cache.has(String(cfg.guild_review_role));
  if (!hasRole && !member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'You do not have permission to use this command', ephemeral: true });

  const target = interaction.options.getUser('user');
  const targetMember = await interaction.guild.members.fetch(target.id).catch(()=>null);

  if (sub === 'approve') {
    // Assign guild_member_role
    if (!cfg.guild_member_role) return interaction.reply({ content: 'guild_member_role not configured. Run /ticket setup guild_member_role', ephemeral: true });
    try {
      if (targetMember) await targetMember.roles.add(String(cfg.guild_member_role)).catch(()=>{});
      // DM user
      try {
        const emb = new EmbedBuilder().setTitle('✅ Guild Application Approved').setColor(0x00ff00).setDescription('Your guild application was approved. Welcome!');
        await targetMember.send({ embeds: [emb] }).catch(()=>{});
      } catch(e){}

      // transcript and post to log_channel
      const ch = interaction.channel;
      const attachment = await generateTranscript(ch, ticket);
      if (cfg.log_channel && attachment) {
        const logCh = await interaction.guild.channels.fetch(cfg.log_channel).catch(()=>null);
        if (logCh) {
          const emb = new EmbedBuilder().setTitle('📋 Ticket Transcript').setColor(0x5865f2).addFields(
            { name: 'Type', value: 'guild', inline: true },
            { name: 'User', value: `<@${ticket.user_id}>`, inline: true },
            { name: 'Status', value: 'Approved', inline: true },
            { name: 'Resolved by', value: `<@${interaction.user.id}>`, inline: true }
          );
          await logCh.send({ embeds: [emb], files: [attachment] }).catch(()=>{});
        }
      }

      DB.updateTicketStatus(ticket.id, 'closed', new Date().toISOString());
      await interaction.reply({ content: 'Application approved', ephemeral: true });
      await interaction.channel.delete().catch(()=>{});
    } catch (e) {
      console.error(e);
      await interaction.reply({ content: 'Error approving application', ephemeral: true });
    }
  }

  if (sub === 'reject') {
    try {
      if (targetMember) {
        const emb = new EmbedBuilder().setTitle('❌ Guild Application Rejected').setColor(0xff0000).setDescription('Your guild application was rejected.');
        await targetMember.send({ embeds: [emb] }).catch(()=>{});
      }
      // transcript and post to log_channel
      const ch = interaction.channel;
      const attachment = await generateTranscript(ch, ticket);
      if (cfg.log_channel && attachment) {
        const logCh = await interaction.guild.channels.fetch(cfg.log_channel).catch(()=>null);
        if (logCh) {
          const emb = new EmbedBuilder().setTitle('📋 Ticket Transcript').setColor(0x5865f2).addFields(
            { name: 'Type', value: 'guild', inline: true },
            { name: 'User', value: `<@${ticket.user_id}>`, inline: true },
            { name: 'Status', value: 'Rejected', inline: true },
            { name: 'Resolved by', value: `<@${interaction.user.id}>`, inline: true }
          );
          await logCh.send({ embeds: [emb], files: [attachment] }).catch(()=>{});
        }
      }

      DB.updateTicketStatus(ticket.id, 'archived');
      await interaction.reply({ content: 'Application rejected', ephemeral: true });
      await interaction.channel.delete().catch(()=>{});
    } catch (e) {
      console.error(e);
      await interaction.reply({ content: 'Error rejecting application', ephemeral: true });
    }
  }
}
