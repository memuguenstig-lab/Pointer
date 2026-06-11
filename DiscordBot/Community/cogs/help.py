import discord
from discord.ext import commands
from discord import app_commands
from typing import Optional

from utils.helpers import create_embed

class HelpView(discord.ui.View):
    def __init__(self, bot, interaction: discord.Interaction):
        super().__init__(timeout=300)  # 5 minutes timeout
        self.bot = bot
        self.interaction = interaction
        self.current_category = "economy"
        
    @discord.ui.button(label="Economy", style=discord.ButtonStyle.primary, emoji="💰")
    async def economy_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_category = "economy"
        embed = await self.get_category_embed("economy")
        await interaction.response.edit_message(embed=embed, view=self)
        
    @discord.ui.button(label="Fun", style=discord.ButtonStyle.primary, emoji="🎮")
    async def fun_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_category = "fun"
        embed = await self.get_category_embed("fun")
        await interaction.response.edit_message(embed=embed, view=self)
        
    @discord.ui.button(label="Leveling", style=discord.ButtonStyle.primary, emoji="📈")
    async def leveling_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_category = "leveling"
        embed = await self.get_category_embed("leveling")
        await interaction.response.edit_message(embed=embed, view=self)
        
    @discord.ui.button(label="Jobs", style=discord.ButtonStyle.primary, emoji="💼")
    async def jobs_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_category = "jobs"
        embed = await self.get_category_embed("jobs")
        await interaction.response.edit_message(embed=embed, view=self)
        
    @discord.ui.button(label="Admin", style=discord.ButtonStyle.primary, emoji="⚙️")
    async def admin_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.current_category = "admin"
        embed = await self.get_category_embed("admin")
        await interaction.response.edit_message(embed=embed, view=self)
        
    async def get_category_embed(self, category: str) -> discord.Embed:
        # Get all commands from the bot's cogs
        category_commands = []
        for cog in self.bot.cogs.values():
            if cog.qualified_name.lower() == category:
                # Get all app commands from the cog
                for cmd in cog.get_app_commands():
                    category_commands.append(cmd)
        
        # Create embed
        embed = create_embed(
            title=f"{category.title()} Commands",
            description="Here are all the available commands in this category:",
            color=discord.Color.blue()
        )
        
        # Add commands to embed
        for cmd in category_commands:
            # Get command description
            description = cmd.description or "No description available"
            
            # Get command parameters
            params = []
            for param in cmd.parameters:
                if param.required:
                    params.append(f"<{param.name}>")
                else:
                    params.append(f"[{param.name}]")
            
            # Format command usage
            usage = f"/{cmd.name} {' '.join(params)}" if params else f"/{cmd.name}"
            
            # Add field
            embed.add_field(
                name=usage,
                value=description,
                inline=False
            )
        
        if not category_commands:
            embed.description = "No commands found in this category."
        
        return embed

class Help(commands.Cog):
    """Help commands for the bot"""
    
    def __init__(self, bot):
        self.bot = bot
        
    @app_commands.command(name="help", description="Get help with bot commands")
    async def help(self, interaction: discord.Interaction):
        """Show help menu with command categories"""
        # Create view
        view = HelpView(self.bot, interaction)
        
        # Get initial embed
        embed = create_embed(
            title="ShadowIDE Bot Help",
            description="Select a category to view its commands:",
            color=discord.Color.blue()
        )
        
        # Add category descriptions
        embed.add_field(
            name="💰 Economy",
            value="Commands for managing your ShadowIDE Coins",
            inline=True
        )
        embed.add_field(
            name="🎮 Fun",
            value="Entertainment and utility commands",
            inline=True
        )
        embed.add_field(
            name="📈 Leveling",
            value="Commands for the leveling system",
            inline=True
        )
        embed.add_field(
            name="💼 Jobs",
            value="Commands for the job system",
            inline=True
        )
        embed.add_field(
            name="⚙️ Admin",
            value="Administrative commands",
            inline=True
        )
        
        # Send message with view
        await interaction.response.send_message(embed=embed, view=view)

async def setup(bot):
    await bot.add_cog(Help(bot)) 