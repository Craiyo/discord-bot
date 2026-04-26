import { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { DB } from '../db.js';

export const name = 'interactionCreate';
export const once = false;

// Temporary in-memory store for community modal data keyed by userId
const pendingCommunityData = new Map();
// Timers for raid start pings keyed by partyId
const raidPingTimers = new Map();

async function generateTranscript(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const ordered = Array.from(messages.values()).reverse();
    const transcript = ordered.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join('\n');
    const filename = `transcript-${channel.name}-${new Date().toISOString().slice(0,10)}.txt`;
    const buffer = Buffer.from(transcript, 'utf8');
    return new AttachmentBuilder(buffer, { name: filename });
  } catch (e) {
    console.error('generateTranscript error', e);
    return null;
  }
}

export async function execute(interaction, client) {
  try {
    // Ignore interactions outside of guilds (DMs)
    if (!interaction.guildId) return;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }

    // Button interactions
    if (interaction.isButton()) {
      const custom = interaction.customId || '';

      // Unified panel buttons
      if (custom === 'ticket_community') {
        const { CommunityModal } = await import('../views/ticketViews.js');
        return interaction.showModal(CommunityModal());
      }
      if (custom === 'ticket_guild') {
        const { GuildModal } = await import('../views/ticketViews.js');
        return interaction.showModal(GuildModal());
      }
      if (custom === 'ticket_help') {
        const { HelpModal } = await import('../views/ticketViews.js');
        return interaction.showModal(HelpModal());
      }

      // Raid join/leave/close handlers (unchanged)
      if (custom.startsWith('raid_join_')) {
        // format: raid_join_{partyId}_{roleEnc}
        const rest = custom.slice('raid_join_'.length);
        const idx = rest.indexOf('_');
        if (idx === -1) return interaction.reply({ content: 'Invalid button id', ephemeral: true });
        const partyId = Number(rest.slice(0, idx));
        const roleEnc = rest.slice(idx+1);
        const roleName = decodeURIComponent(roleEnc);
        const party = DB.getRaidPartyById(partyId);
        if (!party) return interaction.reply({ content: 'Party not found', ephemeral: true });
        if (party.status !== 'open') return interaction.reply({ content: 'This party is closed', ephemeral: true });
        let roles = [];
        let members = {};
        try { roles = JSON.parse(party.roles); } catch(e) { roles = []; }
        try { members = JSON.parse(party.members); } catch(e) { members = {}; }
        // check already in any role
        for (const r of Object.keys(members)) if ((members[r]||[]).includes(String(interaction.user.id))) return interaction.reply({ content: 'You are already in this party. Leave first.', ephemeral: true });
        const roleDef = roles.find(r=>r.name === roleName);
        if (!roleDef) return interaction.reply({ content: 'Role not found', ephemeral: true });
        const max = Number(roleDef.count) || 0;
        members[roleName] = members[roleName] || [];
        if (members[roleName].length >= max) return interaction.reply({ content: 'That role is full', ephemeral: true });
        members[roleName].push(String(interaction.user.id));
        // check full
        let isFull = true;
        for (const r of roles) {
          const filled = (members[r.name]||[]).length;
          if (filled < Number(r.count)) { isFull = false; break; }
        }
        const newStatus = isFull ? 'full' : 'open';
        DB.updateRaidParty(partyId, JSON.stringify(members), newStatus);
        // edit message
        try {
          const { buildRaidEmbed } = await import('../commands/raid/raid.js');
          const channel = await interaction.guild.channels.fetch(party.channel_id).catch(()=>null);
          if (channel && party.message_id) {
            const updated = buildRaidEmbed(Object.assign({}, party, { members: JSON.stringify(members), status: newStatus }));
            const msg = await channel.messages.fetch(party.message_id).catch(()=>null);
            if (msg) await msg.edit(updated).catch(()=>{});
          }
        } catch (e) { console.error(e); }

        // schedule ping if became full
        if (isFull) {
          // clear existing
          if (raidPingTimers.has(String(partyId))) { clearTimeout(raidPingTimers.get(String(partyId))); raidPingTimers.delete(String(partyId)); }
          (async ()=>{
            let runImmediately = false;
            let sendAt = null;
            try {
              const start = party.start_time;
              let when = new Date(start);
              if (isNaN(when.getTime())) {
                // try HH:MM UTC
                const m = (start||'').match(/^(\d{1,2}):(\d{2})\s*UTC$/i);
                if (m) {
                  const now = new Date();
                  when = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(m[1]), Number(m[2]), 0));
                  if (when.getTime() < Date.now()) when.setUTCDate(when.getUTCDate()+1);
                }
              }
              if (!isNaN(when.getTime())) {
                sendAt = when.getTime() - (5*60*1000);
                const ms = sendAt - Date.now();
                if (ms <= 0) runImmediately = true;
                else {
                  const t = setTimeout(async ()=>{
                    try {
                      const channel = await client.channels.fetch(party.channel_id).catch(()=>null);
                      if (!channel) return;
                      const p = DB.getRaidPartyById(partyId);
                      let membersNow = {};
                      try { membersNow = JSON.parse(p.members); } catch(e){ membersNow = {}; }
                      const all = Object.values(membersNow).flat();
                      if (all.length>0) {
                        const mention = all.map(id=>`<@${id}>`).join(' ');
                        await channel.send(`${mention} ⏰ Raid starting in 5 minutes! Join in-game now.`).catch(()=>{});
                      }
                    } catch(e){}
                    raidPingTimers.delete(String(partyId));
                  }, ms);
                  raidPingTimers.set(String(partyId), t);
                }
              } else runImmediately = true;
            } catch(e){ runImmediately = true; }
            if (runImmediately) {
              try {
                const channel = await client.channels.fetch(party.channel_id).catch(()=>null);
                if (!channel) return;
                const p = DB.getRaidPartyById(partyId);
                let membersNow = {};
                try { membersNow = JSON.parse(p.members); } catch(e){ membersNow = {}; }
                const all = Object.values(membersNow).flat();
                if (all.length>0) {
                  const mention = all.map(id=>`<@${id}>`).join(' ');
                  await channel.send(`${mention} ⏰ Raid starting in 5 minutes! Join in-game now.`).catch(()=>{});
                }
              } catch(e){}
            }
          })();
        }

        return interaction.reply({ content: `You joined as ${roleName}`, ephemeral: true });
      }

      if (custom.startsWith('raid_leave_')) {
        const rest = custom.slice('raid_leave_'.length);
        const partyId = Number(rest);
        const party = DB.getRaidPartyById(partyId);
        if (!party) return interaction.reply({ content: 'Party not found', ephemeral: true });
        let members = {};
        try { members = JSON.parse(party.members); } catch(e) { members = {}; }
        let found = false;
        for (const roleName of Object.keys(members)) {
          const arr = members[roleName];
          const idx = arr.indexOf(String(interaction.user.id));
          if (idx !== -1) { arr.splice(idx,1); found = true; break; }
        }
        if (!found) return interaction.reply({ content: 'You are not in this party', ephemeral: true });
        DB.updateRaidParty(partyId, JSON.stringify(members), 'open');
        // cancel any full timers
        raidPingTimers.delete(String(partyId));
        try {
          const { buildRaidEmbed } = await import('../commands/raid/raid.js');
          const channel = await interaction.guild.channels.fetch(party.channel_id).catch(()=>null);
          if (channel && party.message_id) {
            const updated = buildRaidEmbed(Object.assign({}, party, { members: JSON.stringify(members), status: 'open' }));
            const msg = await channel.messages.fetch(party.message_id).catch(()=>null);
            if (msg) await msg.edit(updated).catch(()=>{});
          }
        } catch(e){console.error(e)}
        return interaction.reply({ content: 'You left the party', ephemeral: true });
      }

      if (custom.startsWith('raid_close_')) {
        const rest = custom.slice('raid_close_'.length);
        const partyId = Number(rest);
        const party = DB.getRaidPartyById(partyId);
        if (!party) return interaction.reply({ content: 'Party not found', ephemeral: true });
        if (String(party.host_id) !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Only the host can close this', ephemeral: true });
        DB.updateRaidParty(partyId, party.members, 'closed');
        try {
          const { buildRaidEmbed } = await import('../commands/raid/raid.js');
          const channel = await interaction.guild.channels.fetch(party.channel_id).catch(()=>null);
          if (channel && party.message_id) {
            const updated = buildRaidEmbed(Object.assign({}, party, { status: 'closed' }));
            const msg = await channel.messages.fetch(party.message_id).catch(()=>null);
            if (msg) await msg.edit(updated).catch(()=>{});
          }
        } catch(e){}
        raidPingTimers.delete(String(partyId));
        return interaction.reply({ content: 'Party closed', ephemeral: true });
      }



      // existing ticket close/archive
      if (custom.startsWith('ticket_close_')) {
        const ticketId = Number(custom.split('_')[2]);
        const ticket = DB.getTicketByChannel(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: 'Ticket not found', ephemeral: true });
        DB.updateTicketStatus(ticket.id, 'closed', new Date().toISOString());
        DB.addTicketMessage(ticket.id, interaction.user.id, 'Ticket closed');
        await interaction.reply({ content: 'Ticket closed', ephemeral: true });
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false }).catch(()=>{});
        return;
      }

      if (custom.startsWith('ticket_archive_')) {
        const ticket = DB.getTicketByChannel(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: 'Ticket not found', ephemeral: true });
        DB.updateTicketStatus(ticket.id, 'archived');
        DB.addTicketMessage(ticket.id, interaction.user.id, 'Ticket archived');
        // build transcript
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const ordered = Array.from(messages.values()).reverse();
        const transcript = ordered.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join('\n');
        try {
          const owner = await interaction.guild.members.fetch(ticket.user_id);
          await owner.send(`Transcript:\n${transcript.slice(0, 1900)}`).catch(()=>{});
        } catch (e) {}
        await interaction.channel.delete().catch(()=>{});
        return;
      }
    }

    // Modal submits
    if (interaction.isModalSubmit()) {
      const id = interaction.customId || '';

      // Raid template modal submission
      if (id === 'raid_template_modal') {
        const name = interaction.fields.getTextInputValue('name');
        const description = interaction.fields.getTextInputValue('description');
        const sizeRaw = interaction.fields.getTextInputValue('size');
        const rolesRaw = interaction.fields.getTextInputValue('roles');
        const creator = interaction.user.id;
        const size = Number(sizeRaw);
        const lines = (rolesRaw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
        const roles = [];
        let sum = 0;
        for (const line of lines) {
          const parts = line.split(':');
          const rn = parts[0].trim();
          const cnt = Number((parts[1]||'').trim());
          if (!rn || isNaN(cnt)) return interaction.reply({ content: `Invalid roles line: ${line}`, ephemeral: true });
          roles.push({ name: rn, count: cnt });
          sum += cnt;
        }
        if (sum !== size) return interaction.reply({ content: `Sum of role counts (${sum}) does not equal size (${size})`, ephemeral: true });
        DB.saveRaidTemplate(interaction.guild.id, name, description, size, JSON.stringify(roles), creator);
        return interaction.reply({ content: `Template ${name} created — ${size} players`, ephemeral: true });
      }

      // Raid create modal submission
      if (id === 'raid_create_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const templateName = interaction.fields.getTextInputValue('template');
        const sizeRaw = interaction.fields.getTextInputValue('size');
        const rolesRaw = interaction.fields.getTextInputValue('roles');
        const start_time = interaction.fields.getTextInputValue('start_time');
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;
        // check channel registered
        const rc = DB.getRaidChannel(channelId);
        if (!rc) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('This channel is not registered for raid parties. Ask an admin to use /setup raid_channel_add').setColor(0xff0000)], ephemeral: true });
        let roles = [];
        let size = null;
        let description = '';
        if (templateName && templateName.trim().length>0) {
          const tpl = DB.getRaidTemplate(guildId, templateName.trim());
          if (!tpl) return interaction.reply({ content: 'Template not found. Use /template list to see available templates', ephemeral: true });
          size = tpl.size;
          description = tpl.description || '';
          try { roles = JSON.parse(tpl.roles); } catch(e){ roles = []; }
        } else {
          size = Number(sizeRaw);
          if (!size || size <= 0) return interaction.reply({ content: 'Invalid size', ephemeral: true });
          const lines = (rolesRaw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
          let sum = 0;
          for (const line of lines) {
            const parts = line.split(':');
            const rn = parts[0].trim();
            const cnt = Number((parts[1]||'').trim());
            if (!rn || isNaN(cnt)) return interaction.reply({ content: `Invalid roles line: ${line}`, ephemeral: true });
            roles.push({ name: rn, count: cnt });
            sum += cnt;
          }
          if (sum !== size) return interaction.reply({ content: `Sum of role counts (${sum}) does not equal size (${size})`, ephemeral: true });
        }
        // initial members object
        const members = {};
        for (const r of roles) members[r.name] = [];
        const partyId = DB.saveRaidParty(guildId, channelId, null, interaction.user.id, title, description, size, JSON.stringify(roles), JSON.stringify(members), start_time);
        // build embed and post
        const { buildRaidEmbed } = await import('../commands/raid/raid.js');
        const party = DB.getRaidPartyById(partyId);
        const payload = buildRaidEmbed(party);
        const msg = await interaction.channel.send(payload);
        DB.updateRaidPartyMessage(partyId, msg.id);
        return interaction.reply({ content: 'Raid party created!', ephemeral: true });
      }

      // Community modal submission: collect fields, validate breci, then prompt tier select
      if (id === 'community_modal') {
        const ign = interaction.fields.getTextInputValue('ign');
        const breci = interaction.fields.getTextInputValue('breci');
        const can_vc = interaction.fields.getTextInputValue('can_vc');
        const open_mic = interaction.fields.getTextInputValue('open_mic');
        // validate breci
        const val = (breci || '').trim().toLowerCase();
        if (val !== 'yes' && val !== 'y') {
          const emb = new EmbedBuilder().setTitle('Application Rejected').setColor(0xff0000).setDescription('You must have Brecilien unlocked to apply for community access.');
          return interaction.reply({ embeds: [emb], ephemeral: true });
        }
        // store pending data
        pendingCommunityData.set(interaction.user.id, { ign, breci: 'Yes', can_vc, open_mic });
        // send select menu for tier — limited to three options as requested
        const options = [
          { label: 'Tier 3-6', value: '3-6' },
          { label: 'Tier 7', value: '7' },
          { label: 'Tier 8', value: '8' }
        ];
        const select = new StringSelectMenuBuilder().setCustomId('community_tier_select').setPlaceholder('Select your Tracking Toolkit Tier').addOptions(options);
        const row = new ActionRowBuilder().addComponents(select);
        await interaction.reply({ content: 'Select your Tracking Toolkit Tier', components: [row], ephemeral: true });
        return;
      }

      // Guild modal submission
      if (id === 'guild_modal') {
        const ign = interaction.fields.getTextInputValue('ign');
        const pve = interaction.fields.getTextInputValue('pve_fame');
        const pvp = interaction.fields.getTextInputValue('pvp_fame');
        const primary_weapon = interaction.fields.getTextInputValue('primary_weapon');
        const vc_mic = interaction.fields.getTextInputValue('vc_mic');
        const [can_vc, open_mic] = (vc_mic || '').split('/').map(s => s.trim());
        const cfg = DB.getGuildConfig(interaction.guild.id) || {};
        if (!cfg.guild_app_category || !cfg.guild_review_role) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Guild application category or review role not configured. Run /setup').setColor(0xff0000)], ephemeral: true });
        const permissionOverwrites = [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: cfg.guild_review_role, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ];
        const channel = await interaction.guild.channels.create({ name: `guild-app-${interaction.user.username}`, type: 0, parent: cfg.guild_app_category, permissionOverwrites });
        const embed = new EmbedBuilder().setTitle('⚔️ Guild Application').setColor(0xe74c3c).addFields(
          { name: 'IGN', value: ign, inline: true },
          { name: 'PVE Fame', value: pve, inline: true },
          { name: 'PVP Fame', value: pvp, inline: true },
          { name: 'Primary Weapon', value: primary_weapon, inline: true },
          { name: 'Can Join VC / Open Mic', value: vc_mic, inline: true },
          { name: 'Applicant', value: `<@${interaction.user.id}>`, inline: false }
        );
        // action buttons
        const approve = new ButtonBuilder().setCustomId(`guild_approve_${interaction.user.id}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success);
        const reject = new ButtonBuilder().setCustomId(`guild_reject_${interaction.user.id}`).setLabel('❌ Reject').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approve, reject);
        const msg = await channel.send({ embeds: [embed], components: [row] });
        await channel.send({ content: `<@${interaction.user.id}> Please upload your **Character Screenshot** and **Stats Screenshot** in this channel for verification.` });
        const ticketId = DB.saveTicket(interaction.guild.id, channel.id, interaction.user.id, 'open', 'guild');
        await interaction.reply({ content: 'Your guild application has been submitted!', ephemeral: true });
        return;
      }

      // Help modal submission
      if (id === 'help_modal') {
        const issue = interaction.fields.getTextInputValue('issue');
        const cfg = DB.getGuildConfig(interaction.guild.id) || {};
        if (!cfg.help_category) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Help category not configured. Run /setup').setColor(0xff0000)], ephemeral: true });
        const permissionOverwrites = [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ];
        if (cfg.support_role) permissionOverwrites.push({ id: cfg.support_role, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
        const channel = await interaction.guild.channels.create({ name: `help-${interaction.user.username}`, type: 0, parent: cfg.help_category, permissionOverwrites });
        const embed = new EmbedBuilder().setTitle('🆘 Help Request').setColor(0x5865F2).addFields({ name: 'Issue', value: issue }, { name: 'Applicant', value: `<@${interaction.user.id}>` });
        const { ticketActionRow } = await import('../views/ticketViews.js');
        const ticketId = DB.saveTicket(interaction.guild.id, channel.id, interaction.user.id, 'open', 'help');
        await channel.send({ embeds: [embed], components: [ticketActionRow(ticketId)] });
        await interaction.reply({ content: 'Help ticket created!', ephemeral: true });
        return;
      }
    }

    // Select menu for community tier
    if (interaction.isStringSelectMenu()) {
      const cid = interaction.customId || '';
      if (cid === 'community_tier_select') {
        const selected = interaction.values && interaction.values[0];
        const data = pendingCommunityData.get(interaction.user.id);
        if (!data) return interaction.reply({ content: 'No pending application found. Please re-open the application.', ephemeral: true });
        const tier = selected; // values: '3-6', '7', '8'
        const cfg = DB.getGuildConfig(interaction.guild.id) || {};
        if (!cfg.community_category || !cfg.community_review_role) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Community category or review role not configured. Run /setup').setColor(0xff0000)], ephemeral: true });
        const permissionOverwrites = [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: cfg.community_review_role, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ];
        const channel = await interaction.guild.channels.create({ name: `community-${interaction.user.username}`, type: 0, parent: cfg.community_category, permissionOverwrites });
        const embed = new EmbedBuilder().setTitle('🌍 Community Invite Application').setColor(0x3498db).addFields(
          { name: 'IGN', value: data.ign, inline: true },
          { name: 'Brecilien Unlocked', value: data.breci, inline: true },
          { name: 'Tracking Toolkit Tier', value: String(tier), inline: true },
          { name: 'Can Join VC', value: data.can_vc, inline: true },
          { name: 'Open Mic', value: data.open_mic, inline: true },
          { name: 'Applicant', value: `<@${interaction.user.id}>`, inline: false }
        );
        const approve = new ButtonBuilder().setCustomId(`comm_approve_${interaction.user.id}_${tier}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success);
        const reject = new ButtonBuilder().setCustomId(`comm_reject_${interaction.user.id}`).setLabel('❌ Reject').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approve, reject);
        await channel.send({ embeds: [embed], components: [row] });
        DB.saveTicket(interaction.guild.id, channel.id, interaction.user.id, 'open', 'community');
        pendingCommunityData.delete(interaction.user.id);
        await interaction.update({ content: 'Your application has been submitted!', components: [], ephemeral: true });
        return;
      }
    }
  } catch (err) {
    console.error('Interaction handler error', err);
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content: 'Error occurred', ephemeral: true });
      else await interaction.reply({ content: 'Error occurred', ephemeral: true });
    } catch (e) {}
  }
}
