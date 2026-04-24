import { DB } from '../db.js';
export const name = 'guildMemberAdd';
export const once = false;
export async function execute(member) {
  DB.insertAuditLog(member.guild.id, member.id, 'member_join', `${member.user.tag} joined`);
  const cfg = DB.getGuildConfig(member.guild.id);
  if (cfg && cfg.log_channel) {
    const ch = member.guild.channels.cache.get(String(cfg.log_channel));
    if (ch) ch.send({ embeds: [{ title: 'Member Joined', description: `${member.user.tag} joined` }] }).catch(()=>{});
  }
}
