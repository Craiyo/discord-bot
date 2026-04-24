import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin');
export async function execute(interaction) {
  const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Coinflip').setDescription(res).setColor(0x00ccff)] });
}
