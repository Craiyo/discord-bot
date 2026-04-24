import 'dotenv/config';
import fs from 'fs';
import { mkdirSync } from 'fs';
import path from 'path';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { DB } from './db.js';
import { DISCORD_TOKEN } from './config.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(process.cwd(), 'commands');
for (const category of fs.readdirSync(commandsPath)) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.lstatSync(categoryPath).isDirectory()) continue;
  for (const file of fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))) {
    const filePath = path.join(categoryPath, file);
    const command = (await import(filePath));
    if (command && command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
}

// Load events
const eventsPath = path.join(process.cwd(), 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const { name, once, execute } = await import(path.join(eventsPath, file));
  if (once) client.once(name, (...args) => execute(...args, client));
  else client.on(name, (...args) => execute(...args, client));
}

// Ensure data directory exists
mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });

// Initialize DB (synchronous)
DB.init();

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});
