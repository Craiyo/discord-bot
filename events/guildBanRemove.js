import { DB } from '../db.js';
export const name = 'guildBanRemove';
export const once = false;
export async function execute(guild, user) {
  DB.insertAuditLog(guild.id, user.id, 'member_unban', `${user.tag} unbanned`);
  const cfg = DB.getGuildConfig(guild.id);
  if (cfg && cfg.log_channel) {
    const ch = guild.channels.cache.get(String(cfg.log_channel));
    if (ch) ch.send({ embeds: [{ title: 'Member Unbanned', description: `${user.tag} was unbanned` }] }).catch(()=>{});
  }
}
