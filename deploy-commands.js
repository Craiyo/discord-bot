// deploy-commands.js
import { REST, Routes } from 'discord.js';
import { readdirSync, lstatSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { DISCORD_TOKEN, CLIENT_ID } from './config.js';

export async function deployCommands() {
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
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`[Deploy] ${commands.length} global commands registered.`);
}

// Allow running standalone: node deploy-commands.js
if (process.argv[1].includes('deploy-commands')) {
  deployCommands().then(() => process.exit(0));
}