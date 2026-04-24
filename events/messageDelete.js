import { DB } from '../db.js';
export const name = 'messageDelete';
export const once = false;
export async function execute(message) {
  if (!message.guild) return;
  if (message.author && message.author.bot) return;
  DB.insertAuditLog(message.guild.id, message.author ? message.author.id : 0, 'message_delete', message.content || '');
  const cfg = DB.getGuildConfig(message.guild.id);
  if (cfg && cfg.log_channel) {
    const ch = message.guild.channels.cache.get(String(cfg.log_channel));
    if (ch) ch.send({ embeds: [{ title: 'Message Deleted', description: `Author: ${message.author?.tag}\nContent: ${message.content}` }] }).catch(()=>{});
  }
}
