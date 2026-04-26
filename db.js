import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data', 'bot.db');

export const DB = {
  db: null,

  init() {
    this.db = new Database(DB_PATH);

    // Base guild_config (older installs may be missing new columns)
    this.db.prepare(`CREATE TABLE IF NOT EXISTS guild_config (
      guild_id INTEGER PRIMARY KEY,
      log_channel INTEGER,
      ticket_category INTEGER,
      support_role INTEGER
    )`).run();

    // Ensure new guild_config columns exist (add if missing)
    const cols = this.db.prepare("PRAGMA table_info('guild_config')").all().map(c => c.name);
    const addCol = (name) => {
      if (!cols.includes(name)) {
        this.db.prepare(`ALTER TABLE guild_config ADD COLUMN ${name} INTEGER`).run();
      }
    };
    // legacy community_* columns removed from active usage; keep only role fields and ticket_category
    addCol('community_review_role');
    addCol('guild_review_role');
    addCol('guild_member_role');

    // ticket tiers mapping
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      tier_number INTEGER,
      role_id INTEGER,
      UNIQUE(guild_id, tier_number)
    )`).run();

    // Raid system tables
    this.db.prepare(`CREATE TABLE IF NOT EXISTS raid_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      channel_id INTEGER UNIQUE,
      channel_type TEXT,
      label TEXT
    )`).run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS raid_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      name TEXT,
      description TEXT,
      size INTEGER,
      roles TEXT,
      created_by INTEGER
    )`).run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS raid_parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      channel_id INTEGER,
      message_id INTEGER,
      host_id INTEGER,
      title TEXT,
      description TEXT,
      size INTEGER,
      roles TEXT,
      members TEXT,
      start_time TEXT,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      user_id INTEGER,
      event_type TEXT,
      detail TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      channel_id INTEGER UNIQUE,
      user_id INTEGER,
      status TEXT DEFAULT 'open',
      topic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )`).run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER REFERENCES tickets(id),
      user_id INTEGER,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS content_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER,
      template TEXT,
      title TEXT,
      data TEXT,
      posted_by INTEGER,
      channel_id INTEGER,
      message_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
  },

  // Guild config helpers
  getGuildConfig(guildId) {
    const row = this.db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
    return row || null;
  },

  // Accept partial updates and merge with existing
  setGuildConfig(guildId, updates = {}) {
    const existing = this.getGuildConfig(guildId);
    const merged = Object.assign({
      log_channel: null,
      ticket_category: null,
      support_role: null,
      community_review_role: null,
      guild_review_role: null,
      guild_member_role: null
    }, existing || {}, updates);

    if (existing) {
      this.db.prepare(`UPDATE guild_config SET
        log_channel = ?, ticket_category = ?, support_role = ?,
        community_review_role = ?, guild_review_role = ?, guild_member_role = ?
        WHERE guild_id = ?`).run(
        merged.log_channel, merged.ticket_category, merged.support_role,
        merged.community_review_role, merged.guild_review_role, merged.guild_member_role,
        guildId
      );
    } else {
      this.db.prepare(`INSERT INTO guild_config (
        guild_id, log_channel, ticket_category, support_role,
        community_review_role, guild_review_role, guild_member_role
      ) VALUES (?,?,?,?,?,?,?)`).run(
        guildId,
        merged.log_channel, merged.ticket_category, merged.support_role,
        merged.community_review_role, merged.guild_review_role, merged.guild_member_role
      );
    }
  },

  // Backwards compatible alias
  getTicketByChannelId(channelId) {
    return this.getTicketByChannel(channelId);
  },


  insertAuditLog(guildId, userId, eventType, detail) {
    this.db.prepare('INSERT INTO audit_log (guild_id, user_id, event_type, detail) VALUES (?,?,?,?)')
      .run(guildId, userId, eventType, detail);
  },

  getAuditLogsForUser(guildId, userId, limit = 20) {
    return this.db.prepare('SELECT * FROM audit_log WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?')
      .all(guildId, userId, limit);
  },

  // Tickets
  saveTicket(guildId, channelId, userId, status = 'open', topic = null) {
    const info = this.db.prepare('INSERT INTO tickets (guild_id, channel_id, user_id, status, topic) VALUES (?,?,?,?,?)')
      .run(guildId, channelId, userId, status, topic);
    return info.lastInsertRowid;
  },

  getTickets(guildId, status = null) {
    if (status) return this.db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND status = ? ORDER BY id DESC').all(guildId, status);
    return this.db.prepare('SELECT * FROM tickets WHERE guild_id = ? ORDER BY id DESC').all(guildId);
  },

  getTicketByChannel(channelId) {
    return this.db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
  },

  updateTicketStatus(ticketId, status, closedAt = null) {
    if (closedAt) this.db.prepare('UPDATE tickets SET status = ?, closed_at = ? WHERE id = ?').run(status, closedAt, ticketId);
    else this.db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(status, ticketId);
  },

  addTicketMessage(ticketId, userId, content) {
    this.db.prepare('INSERT INTO ticket_messages (ticket_id, user_id, content) VALUES (?,?,?)').run(ticketId, userId, content);
  },

  // Content posts
  createContentPost(guildId, template, title, data, postedBy, channelId, messageId) {
    const info = this.db.prepare('INSERT INTO content_posts (guild_id, template, title, data, posted_by, channel_id, message_id) VALUES (?,?,?,?,?,?,?)')
      .run(guildId, template, title, JSON.stringify(data), postedBy, channelId, messageId);
    return info.lastInsertRowid;
  },

  getContentPost(id) {
    return this.db.prepare('SELECT * FROM content_posts WHERE id = ?').get(id);
  },

  deleteContentPost(id) {
    this.db.prepare('DELETE FROM content_posts WHERE id = ?').run(id);
  },

  // Ticket tiers helpers
  setTierRole(guildId, tierNumber, roleId) {
    const existing = this.db.prepare('SELECT id FROM ticket_tiers WHERE guild_id = ? AND tier_number = ?').get(guildId, tierNumber);
    if (existing) {
      this.db.prepare('UPDATE ticket_tiers SET role_id = ? WHERE id = ?').run(roleId, existing.id);
    } else {
      this.db.prepare('INSERT INTO ticket_tiers (guild_id, tier_number, role_id) VALUES (?,?,?)').run(guildId, tierNumber, roleId);
    }
  },

  getTierRole(guildId, tierNumber) {
    const row = this.db.prepare('SELECT role_id FROM ticket_tiers WHERE guild_id = ? AND tier_number = ?').get(guildId, tierNumber);
    return row ? row.role_id : null;
  },

  getAllTierRoles(guildId) {
    return this.db.prepare('SELECT tier_number, role_id FROM ticket_tiers WHERE guild_id = ? ORDER BY tier_number').all(guildId);
  },

  deleteTierRole(guildId, tierNumber) {
    this.db.prepare('DELETE FROM ticket_tiers WHERE guild_id = ? AND tier_number = ?').run(guildId, tierNumber);
  },

  /* Raid system helpers */
  addRaidChannel(guildId, channelId, channelType, label) {
    const exists = this.db.prepare('SELECT id FROM raid_channels WHERE channel_id = ?').get(channelId);
    if (exists) {
      this.db.prepare('UPDATE raid_channels SET guild_id = ?, channel_type = ?, label = ? WHERE channel_id = ?')
        .run(guildId, channelType, label, channelId);
    } else {
      this.db.prepare('INSERT INTO raid_channels (guild_id, channel_id, channel_type, label) VALUES (?,?,?,?)')
        .run(guildId, channelId, channelType, label);
    }
  },

  removeRaidChannel(guildId, channelId) {
    this.db.prepare('DELETE FROM raid_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
  },

  getRaidChannel(channelId) {
    return this.db.prepare('SELECT * FROM raid_channels WHERE channel_id = ?').get(channelId) || null;
  },

  getAllRaidChannels(guildId) {
    return this.db.prepare('SELECT * FROM raid_channels WHERE guild_id = ?').all(guildId);
  },

  saveRaidTemplate(guildId, name, description, size, rolesJson, createdBy) {
    const existing = this.db.prepare('SELECT id FROM raid_templates WHERE guild_id = ? AND name = ?').get(guildId, name);
    if (existing) {
      this.db.prepare('UPDATE raid_templates SET description = ?, size = ?, roles = ?, created_by = ? WHERE id = ?')
        .run(description, size, rolesJson, createdBy, existing.id);
      return existing.id;
    } else {
      const info = this.db.prepare('INSERT INTO raid_templates (guild_id, name, description, size, roles, created_by) VALUES (?,?,?,?,?,?)')
        .run(guildId, name, description, size, rolesJson, createdBy);
      return info.lastInsertRowid;
    }
  },

  getRaidTemplate(guildId, name) {
    return this.db.prepare('SELECT * FROM raid_templates WHERE guild_id = ? AND name = ?').get(guildId, name) || null;
  },

  getAllRaidTemplates(guildId) {
    return this.db.prepare('SELECT * FROM raid_templates WHERE guild_id = ? ORDER BY name').all(guildId);
  },

  deleteRaidTemplate(guildId, name) {
    this.db.prepare('DELETE FROM raid_templates WHERE guild_id = ? AND name = ?').run(guildId, name);
  },

  saveRaidParty(guildId, channelId, messageId, hostId, title, description, size, rolesJson, membersJson, startTime) {
    const info = this.db.prepare('INSERT INTO raid_parties (guild_id, channel_id, message_id, host_id, title, description, size, roles, members, start_time) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(guildId, channelId, messageId, hostId, title, description, size, rolesJson, membersJson, startTime);
    return info.lastInsertRowid;
  },

  getRaidPartyByMessage(messageId) {
    return this.db.prepare('SELECT * FROM raid_parties WHERE message_id = ?').get(messageId) || null;
  },

  getRaidPartyById(id) {
    return this.db.prepare('SELECT * FROM raid_parties WHERE id = ?').get(id) || null;
  },

  updateRaidParty(id, membersJson, status) {
    this.db.prepare('UPDATE raid_parties SET members = ?, status = ? WHERE id = ?').run(membersJson, status, id);
  },

  updateRaidPartyMessage(id, messageId) {
    this.db.prepare('UPDATE raid_parties SET message_id = ? WHERE id = ?').run(messageId, id);
  }
};
