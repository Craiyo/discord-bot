import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder().setName('trivia').setDescription('Fetch a trivia question');

export async function execute(interaction) {
  await interaction.deferReply();
  const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
  const data = await res.json();
  if (!data || data.response_code !== 0) return interaction.editReply({ content: 'Failed to fetch question', ephemeral: true });
  const q = data.results[0];
  const correct = q.correct_answer;
  const choices = [...q.incorrect_answers, correct].sort(() => Math.random()-0.5);
  const map = ['A','B','C','D'];
  const embed = new EmbedBuilder().setTitle('Trivia').setDescription(q.question).addFields({ name: 'Choices', value: choices.map((c,i)=>`${map[i]}: ${c}`).join('\n') });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trivia_A').setLabel('A').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('trivia_B').setLabel('B').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('trivia_C').setLabel('C').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('trivia_D').setLabel('D').setStyle(ButtonStyle.Primary)
  );
  const reply = await interaction.editReply({ embeds: [embed], components: [row] });
  const collector = reply.createMessageComponentCollector({ time: 15000 });
  let answered = false;
  collector.on('collect', async i => {
    if (answered) return i.reply({ content: 'Already answered', ephemeral: true });
    const idx = i.customId.split('_')[1];
    const chosen = choices[['A','B','C','D'].indexOf(idx)];
    answered = true;
    const correctIdx = choices.indexOf(correct);
    const correctLabel = ['A','B','C','D'][correctIdx];
    await i.update({ content: `Answer: ${correctLabel} (${correct})`, components: [] });
  });
  collector.on('end', async collected => {
    if (!answered) {
      const correctIdx = choices.indexOf(correct);
      const correctLabel = ['A','B','C','D'][correctIdx];
      await interaction.editReply({ content: `Time up! Answer: ${correctLabel} (${correct})`, components: [] });
    }
  });
}
