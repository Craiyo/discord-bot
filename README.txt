Discord.js v14 bot

Install:
  npm install

Setup:
  - Copy .env.example to .env and set DISCORD_TOKEN and CLIENT_ID
  - Run node deploy-commands.js once after the first deploy or after adding new commands to register slash commands globally. (Global commands may take up to 1 hour to propagate.)
  - Start the bot: npm start

Notes:
  - The database file is stored under data/bot.db and is ignored by git.
  - Ensure you rotate your bot token if it was exposed.
