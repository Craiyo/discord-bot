import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('rps').setDescription('Play rock-paper-scissors').addStringOption(o=>o.setName('choice').setDescription('rock|paper|scissors').setRequired(true).addChoices({ name: 'rock', value: 'rock' }, { name: 'paper', value: 'paper' }, { name: 'scissors', value: 'scissors' }));

export async function execute(interaction) {
  const user = interaction.options.getString('choice');
  const botChoice = ['rock','paper','scissors'][Math.floor(Math.random()*3)];
  const wins = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  let result = 'Tie';
  if (wins[user] === botChoice) result = 'You win';
  else if (wins[botChoice] === user) result = 'You lose';
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('RPS').setDescription(`You: ${user}\nBot: ${botChoice}\nResult: ${result}`)] });
}
