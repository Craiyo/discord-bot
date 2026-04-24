import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Roll dice (e.g. 2d6+3)')
  .addStringOption(opt => opt.setName('dice').setDescription('XdY+Z').setRequired(true));

export async function execute(interaction) {
  const dice = interaction.options.getString('dice').replace(/\s+/g, '');
  const m = dice.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!m) return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Invalid format').setColor(0xff0000)], ephemeral: true });
  const n = parseInt(m[1], 10), sides = parseInt(m[2], 10), mod = parseInt(m[3] || '0', 10);
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((a,b)=>a+b,0) + mod;
  const embed = new EmbedBuilder().setTitle('Dice Roll').addFields({ name: 'Rolls', value: JSON.stringify(rolls) }, { name: 'Modifier', value: String(mod) }, { name: 'Total', value: String(total) });
  await interaction.reply({ embeds: [embed] });
}
