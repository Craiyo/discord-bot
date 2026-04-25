Discord.js v14 bot

Install:
  npm install

Setup:
  1. Copy .env.example to .env and set DISCORD_TOKEN and CLIENT_ID
  2. Run node deploy-commands.js once after the first deploy or after adding new commands to register slash commands globally. (Global commands may take up to 1 hour to propagate.)
  3. Start the bot: npm start

Notes:
  - The database file is stored under data/bot.db and is ignored by git.
  - Ensure you rotate your bot token if it was exposed.

Quick checklist:
  - Ensure .env contains valid DISCORD_TOKEN and CLIENT_ID
  - Run: node deploy-commands.js (only required once after deploy or when commands change)
  - Run: npm start

Troubleshooting:
  - If commands fail to register, verify DISCORD_TOKEN and CLIENT_ID in .env and that the token belongs to a bot application.
  - If the bot crashes on first run, ensure the data/ directory exists (the bot creates it automatically).
  - For permission issues, invite the bot with Administrator or the needed permissions.
