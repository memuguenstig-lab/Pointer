import os
import asyncio
import logging
import discord
from discord.ext import commands
from dotenv import load_dotenv

from utils.logger import setup_logger

# Load environment variables
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')
GUILD_ID = int(os.getenv('GUILD_ID'))
LOG_CHANNEL_ID = int(os.getenv('LOG_CHANNEL_ID'))

# Set up logging
logger = setup_logger()

# Set up intents
intents = discord.Intents.default()
intents.members = True  # Needed for moderation commands
intents.presences = True  # Needed for status information

class ShadowIDEBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix="!",  # Prefix won't be used with slash commands
            intents=intents,
            help_command=None,  # Disable default help command
        )
        self.log_channel = None

    async def setup_hook(self):
        # Load cogs
        await self.load_extension("cogs.moderation")
        logger.info("Loaded moderation cog")
        
        await self.load_extension("cogs.tickets")
        logger.info("Loaded tickets cog")
        
        # Sync commands with guild
        self.tree.copy_global_to(guild=discord.Object(id=GUILD_ID))
        await self.tree.sync(guild=discord.Object(id=GUILD_ID))
        logger.info(f"Synced slash commands to guild: {GUILD_ID}")

    async def on_ready(self):
        logger.info(f"Logged in as {self.user.name} | {self.user.id}")
        await self.change_presence(activity=discord.Activity(
            type=discord.ActivityType.watching, 
            name="ShadowIDE | https://shadowide.f1shy312.com"
        ))
        
        # Set up log channel
        self.log_channel = self.get_channel(LOG_CHANNEL_ID)
        if not self.log_channel:
            logger.error(f"Could not find log channel with ID: {LOG_CHANNEL_ID}")
        else:
            logger.info(f"Log channel set to: {self.log_channel.name}")

async def main():
    bot = ShadowIDEBot()
    async with bot:
        await bot.start(TOKEN)

if __name__ == "__main__":
    asyncio.run(main()) 