import { REST, Routes } from 'discord.js';
import { DISCORD_TOKEN, CLIENT_ID } from './config.js';
import { readdirSync, lstatSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const commands = [];
const commandsPath = join(process.cwd(), 'commands');

for (const category of readdirSync(commandsPath)) {
  const categoryPath = join(commandsPath, category);
  if (!lstatSync(categoryPath).isDirectory()) continue;
  for (const file of readdirSync(categoryPath).filter(f => f.endsWith('.js'))) {
    const command = await import(pathToFileURL(join(categoryPath, file)).href);
    if (command?.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(DISCORD_TOKEN);

console.log(`Registering ${commands.length} global commands...`);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log('Done — commands will appear in all servers within 1 hour.');