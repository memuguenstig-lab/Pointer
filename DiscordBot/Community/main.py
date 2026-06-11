import os
import discord
from discord.ext import commands
from discord import app_commands
import asyncio
import logging
import json
import datetime
from dotenv import load_dotenv
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('shadowide_bot')

# Load environment variables
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')
GUILD_ID = os.getenv('GUILD_ID')

# Define intents
intents = discord.Intents.default()
intents.members = True
intents.message_content = True

# Create bot instance
class ShadowIDEBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix='!',  # Fallback prefix (not used for slash commands)
            intents=intents,
            activity=discord.Activity(type=discord.ActivityType.watching, name="ShadowIDE Community"),
            status=discord.Status.online
        )
        self.initial_extensions = [
            'cogs.economy',
            'cogs.fun',
            'cogs.leveling',
            'cogs.jobs',
            'cogs.admin',
            'cogs.help',
            'cogs.shop',
            'cogs.giveaway',
        ]
        
    async def setup_hook(self):
        # Load extensions
        for extension in self.initial_extensions:
            try:
                await self.load_extension(extension)
                logger.info(f"Loaded extension: {extension}")
            except Exception as e:
                logger.error(f"Failed to load extension {extension}: {e}")
                traceback.print_exc()
        
        # Sync commands for the specific guild
        guild = discord.Object(id=int(GUILD_ID))
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)
        logger.info("Synced commands to guild")
            
    async def on_ready(self):
        logger.info(f"{self.user} is connected to Discord!")
        logger.info(f"Connected to {len(self.guilds)} guild(s)")
        
        # Create necessary directories if they don't exist
        os.makedirs("data", exist_ok=True)
        
        # Initialize database files if they don't exist
        self.initialize_data_files()
            
    def initialize_data_files(self):
        # Initialize economy data
        if not os.path.exists("data/economy.json"):
            with open("data/economy.json", "w") as f:
                json.dump({}, f)
            logger.info("Created economy.json")
            
        # Initialize leveling data
        if not os.path.exists("data/levels.json"):
            with open("data/levels.json", "w") as f:
                json.dump({}, f)
            logger.info("Created levels.json")
            
        # Initialize jobs data
        if not os.path.exists("data/jobs.json"):
            jobs_data = {
                "jobs": [
                    {
                        "id": "miner",
                        "name": "Miner",
                        "description": "Mine for coins every 30 minutes",
                        "pay_rate": 50,
                        "pay_interval": 30  # minutes
                    },
                    {
                        "id": "farmer",
                        "name": "Farmer",
                        "description": "Farm for coins every hour",
                        "pay_rate": 120,
                        "pay_interval": 60  # minutes
                    },
                    {
                        "id": "programmer",
                        "name": "Programmer",
                        "description": "Code for coins every 2 hours",
                        "pay_rate": 300,
                        "pay_interval": 120  # minutes
                    }
                ],
                "user_jobs": {}
            }
            with open("data/jobs.json", "w") as f:
                json.dump(jobs_data, f, indent=4)
            logger.info("Created jobs.json with default jobs")
            
        # Initialize giveaways data
        if not os.path.exists("data/giveaways.json"):
            with open("data/giveaways.json", "w") as f:
                json.dump({}, f)
            logger.info("Created giveaways.json")

# Run the bot
async def main():
    bot = ShadowIDEBot()
    try:
        await bot.start(TOKEN)
    except KeyboardInterrupt:
        await bot.close()

if __name__ == "__main__":
    asyncio.run(main()) 