import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all commands and their usage');

export async function execute(interaction) {
  const commands = interaction.client.commands;
  const embed = new EmbedBuilder()
    .setTitle('Help — Available Commands')
    .setColor(0x5865F2)
    .setTimestamp();

  for (const cmd of commands.values()) {
    try {
      const raw = cmd.data && (typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data);
      if (!raw || !raw.name) continue;
      const name = raw.name;
      const desc = raw.description || 'No description';
      let usage = `/${name}`;

      if (Array.isArray(raw.options) && raw.options.length > 0) {
        const subcommands = raw.options.filter(o => o.type === 1 || o.type === 'SUB_COMMAND');
        if (subcommands.length > 0) {
          // list subcommands
          const scList = subcommands.map(sc => {
            const scName = sc.name;
            const scDesc = sc.description || '';
            const params = (sc.options || []).map(p => `${p.name}${p.required ? '' : '?'}:${p.type || p.type}`).join(' ');
            return `• ${scName} — ${scDesc}${params ? ` (${params})` : ''}`;
          }).join('\n');
          usage += `\n${scList}`;
        } else {
          // top-level options
          const opts = raw.options.map(o => `${o.name}${o.required ? '' : '?'}:${o.type || o.type}`).join(' ');
          if (opts) usage += ` ${opts}`;
        }
      }

      embed.addFields({ name: `/${name}`, value: `${desc}\n${usage}`, inline: false });
    } catch (e) {
      // skip problematic command
      continue;
    }
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
