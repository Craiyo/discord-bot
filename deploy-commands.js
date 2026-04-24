import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { CLIENT_ID, DISCORD_TOKEN } from './config.js';

const commands = [];
const commandsPath = path.join(process.cwd(), 'commands');
for (const category of fs.readdirSync(commandsPath)) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.lstatSync(categoryPath).isDirectory()) continue;
  for (const file of fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))) {
    const filePath = path.join(categoryPath, file);
    const command = (await import(filePath));
    if (command && command.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands (global).`);
    // Register commands globally
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Successfully reloaded global application (/) commands.');
    console.log('Note: global commands may take up to 1 hour to propagate.');
  } catch (error) {
    console.error(error);
  }
})();
