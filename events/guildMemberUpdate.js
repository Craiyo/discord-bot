import { DB } from '../db.js';
export const name = 'guildMemberUpdate';
export const once = false;
export async function execute(oldMember, newMember) {
  const guild = newMember.guild;
  const diffs = [];
  const beforeRoles = new Set(oldMember.roles.cache.map(r=>r.id));
  const afterRoles = new Set(newMember.roles.cache.map(r=>r.id));
  const added = [...afterRoles].filter(x=>!beforeRoles.has(x));
  const removed = [...beforeRoles].filter(x=>!afterRoles.has(x));
  if (added.length) diffs.push(`Roles added: ${added.join(',')}`);
  if (removed.length) diffs.push(`Roles removed: ${removed.join(',')}`);
  if (oldMember.nickname !== newMember.nickname) diffs.push(`Nick changed: ${oldMember.nickname} -> ${newMember.nickname}`);
  if (diffs.length) {
    const detail = diffs.join('\n');
    DB.insertAuditLog(guild.id, newMember.id, 'member_update', detail);
    const cfg = DB.getGuildConfig(guild.id);
    if (cfg && cfg.log_channel) {
      const ch = guild.channels.cache.get(String(cfg.log_channel));
      if (ch) ch.send({ embeds: [{ title: 'Member Updated', description: detail }] }).catch(()=>{});
    }
  }
}
