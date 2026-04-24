import { DB } from '../db.js';
export const name = 'messageUpdate';
export const once = false;
export async function execute(oldMessage, newMessage) {
  if (!oldMessage.guild) return;
  if (oldMessage.author && oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;
  DB.insertAuditLog(oldMessage.guild.id, oldMessage.author ? oldMessage.author.id : 0, 'message_edit', `Before: ${oldMessage.content} After: ${newMessage.content}`);
  const cfg = DB.getGuildConfig(oldMessage.guild.id);
  if (cfg && cfg.log_channel) {
    const ch = oldMessage.guild.channels.cache.get(String(cfg.log_channel));
    if (ch) ch.send({ embeds: [{ title: 'Message Edited', description: `Author: ${oldMessage.author?.tag}\nBefore: ${oldMessage.content}\nAfter: ${newMessage.content}` }] }).catch(()=>{});
  }
}
