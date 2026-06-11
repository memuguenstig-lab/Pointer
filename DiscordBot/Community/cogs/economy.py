import discord
from discord.ext import commands
from discord import app_commands
import random
import asyncio
import os
import time
import datetime
from typing import Optional

from utils.db import Database
from utils.helpers import get_coin_emoji, get_xp_emoji, create_embed, chance, random_amount, send_dm, create_progress_bar, calculate_xp_for_level


class Economy(commands.Cog):
    """Economy commands for managing ShadowIDE Coins"""

    def __init__(self, bot):
        self.bot = bot
        self.coin_emoji = get_coin_emoji()
        self.xp = get_xp_emoji()
        self.last_daily = {}    # {user_id: timestamp}
        self.last_work = {}     # {user_id: timestamp}
        self.last_beg = {}      # {user_id: timestamp}
        self.last_rob = {}      # {user_id: timestamp}
        self.last_fish = {}     # {user_id: timestamp}
        self.last_mine = {}     # {user_id: timestamp}
        
        # Fishing items
        self.fishing_items = [
            {"name": "Small Fish", "chance": 0.5, "value": 20},
            {"name": "Medium Fish", "chance": 0.3, "value": 40},
            {"name": "Large Fish", "chance": 0.15, "value": 80},
            {"name": "Golden Fish", "chance": 0.05, "value": 200}
        ]
        
        # Mining items
        self.mining_items = [
            {"name": "Coal", "chance": 0.5, "value": 15},
            {"name": "Iron", "chance": 0.3, "value": 30},
            {"name": "Gold", "chance": 0.15, "value": 60},
            {"name": "Diamond", "chance": 0.05, "value": 150}
        ]
        
    async def get_profile_embed(self, user_id: int) -> discord.Embed:
        # Get user object
        user = self.bot.get_user(user_id)
        if not user:
            user = await self.bot.fetch_user(user_id)
        
        # Get user data
        balance = Database.get_user_balance(user_id)
        level_data = Database.get_user_level_data(user_id)
        current_level = level_data["level"]
        current_xp = level_data["xp"]
        
        # Calculate XP for next level
        xp_needed_for_current = calculate_xp_for_level(current_level)
        xp_needed_for_next = calculate_xp_for_level(current_level + 1)
        level_progress = current_xp - xp_needed_for_current
        level_total = xp_needed_for_next - xp_needed_for_current
        
        # Create progress bar
        progress_bar = create_progress_bar(level_progress, level_total)
        
        # Get user's job if any
        job_data = Database.get_user_job(user_id)
        if job_data:
            # Get job info from all jobs
            all_jobs = Database.get_all_jobs()
            job_info = next((job for job in all_jobs if job["id"] == job_data["job_id"]), None)
            job_name = job_info["name"] if job_info else "Unknown Job"
            job_salary = job_info["pay_rate"] if job_info else 0
        else:
            job_name = "Unemployed"
            job_salary = 0
        
        # Create embed
        embed = create_embed(
            title=f"👤 {user.display_name}'s Profile",
            color=user.accent_color or discord.Color.blue(),
            thumbnail=user.display_avatar.url
        )
        
        # Add user info section
        user_info = [
            f"**Username:** {user.name}",
            f"**ID:** {user.id}",
            f"**Account Created:** <t:{int(user.created_at.timestamp())}:R>"
        ]
        
        # Try to get member info if in a guild
        if self.bot.guilds:
            for guild in self.bot.guilds:
                member = guild.get_member(user_id)
                if member:
                    user_info.append(f"**Joined Server:** <t:{int(member.joined_at.timestamp())}:R>")
                    if member.activity:
                        activity_type = str(member.activity.type).split(".")[1].title()
                        activity_name = member.activity.name
                        user_info.append(f"**Activity:** {activity_type} {activity_name}")
                    break
        
        embed.add_field(
            name="📝 User Info",
            value="\n".join(user_info),
            inline=False
        )
        
        # Add economy section
        embed.add_field(
            name="💰 Economy",
            value=(
                f"**Balance:** {balance} {self.coin_emoji}\n"
                f"**Job:** {job_name}\n"
                f"**Salary:** {job_salary} {self.coin_emoji}/hour"
            ),
            inline=True
        )
        
        # Add leveling section
        embed.add_field(
            name="📈 Leveling",
            value=(
                f"**Level:** {current_level}\n"
                f"**XP:** {current_xp}\n"
                f"**Progress:** {progress_bar} {level_progress}/{level_total} XP"
            ),
            inline=True
        )
        
        # Add badges section (placeholder for future features)
        embed.add_field(
            name="🏆 Badges",
            value="Coming soon!",
            inline=False
        )
        
        # Add footer with timestamp
        embed.set_footer(text=f"Profile last updated • {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return embed
    
    @app_commands.command(name="balance", description="Check your ShadowIDE Coin balance or another user's balance")
    async def balance(self, interaction: discord.Interaction, user: Optional[discord.User] = None):
        """Check your balance or another user's balance"""
        target_user = user or interaction.user
        balance = Database.get_user_balance(target_user.id)
        
        if target_user == interaction.user:
            await interaction.response.send_message(f"Your balance: {balance} {self.coin_emoji}")
        else:
            await interaction.response.send_message(f"{target_user.name}'s balance: {balance} {self.coin_emoji}")
    
    @app_commands.command(name="pay", description="Pay ShadowIDE Coins to another user")
    async def pay(self, interaction: discord.Interaction, user: discord.User, amount: int):
        """Pay another user"""
        # Check if amount is valid
        if amount <= 0:
            await interaction.response.send_message("Amount must be positive.", ephemeral=True)
            return
        
        # Check if user is trying to pay themselves
        if user.id == interaction.user.id:
            await interaction.response.send_message("You can't pay yourself.", ephemeral=True)
            return
        
        # Check if user has enough balance
        sender_balance = Database.get_user_balance(interaction.user.id)
        if sender_balance < amount:
            await interaction.response.send_message(f"You don't have enough ShadowIDE Coins. Your balance: {sender_balance} {self.coin_emoji}", ephemeral=True)
            return
        
        # Perform the transaction
        Database.update_user_balance(interaction.user.id, amount, "subtract")
        Database.update_user_balance(user.id, amount, "add")
        
        # Send success message
        await interaction.response.send_message(f"You've sent {amount} {self.coin_emoji} to {user.mention}.")
        
        # Send DM to recipient
        embed = create_embed(
            title="Payment Received",
            description=f"You've received {amount} {self.coin_emoji} from {interaction.user.name}.",
            color=discord.Color.green()
        )
        await send_dm(user, embed=embed)
    
    @app_commands.command(name="daily", description="Claim your daily ShadowIDE Coins")
    async def daily(self, interaction: discord.Interaction):
        """Claim daily coins"""
        user_id = interaction.user.id
        current_time = time.time()
        
        # Check if user has already claimed daily reward
        if user_id in self.last_daily:
            last_claim_time = self.last_daily[user_id]
            time_since_last_claim = current_time - last_claim_time
            
            # Check if 24 hours have passed
            if time_since_last_claim < 86400:  # 24 hours in seconds
                time_remaining = 86400 - time_since_last_claim
                hours = int(time_remaining // 3600)
                minutes = int((time_remaining % 3600) // 60)
                
                await interaction.response.send_message(
                    f"You've already claimed your daily reward. Try again in {hours}h {minutes}m.",
                    ephemeral=True
                )
                return
        
        # Give daily reward
        amount = 250  # Daily reward amount
        Database.update_user_balance(user_id, amount, "add")
        self.last_daily[user_id] = current_time
        
        # Calculate streak (this would be more complex in a real implementation)
        # For now, just use a simple message
        streak_text = "Come back tomorrow for another reward!"
        
        # Send success message
        await interaction.response.send_message(
            f"You've claimed your daily reward of {amount} {self.coin_emoji}!\n{streak_text}"
        )
    
    def check_active_effect(self, user_id: int, effect: str) -> bool:
        """Check if a user has an active effect"""
        # Get shop cog
        shop_cog = self.bot.get_cog("Shop")
        if not shop_cog:
            return False
            
        # Get active effects
        effects = shop_cog.get_active_effects(user_id)
        if effect not in effects:
            return False
            
        expires_at = effects[effect]
        if time.time() > expires_at:
            # Effect has expired, remove it
            shop_cog.remove_effect(user_id, effect)
            return False
            
        return True

    @app_commands.command(name="work", description="Work to earn ShadowIDE Coins")
    async def work(self, interaction: discord.Interaction):
        """Work for coins"""
        user_id = interaction.user.id
        current_time = time.time()
        
        # Check cooldown
        if user_id in self.last_work:
            last_work_time = self.last_work[user_id]
            time_since_last_work = current_time - last_work_time
            
            # Check if 30 minutes have passed (or 15 minutes with work boost)
            cooldown = 900 if self.check_active_effect(user_id, "work_boost") else 1800
            if time_since_last_work < cooldown:
                time_remaining = cooldown - time_since_last_work
                minutes = int(time_remaining // 60)
                seconds = int(time_remaining % 60)
                
                await interaction.response.send_message(
                    f"You need to rest before working again. Try again in {minutes}m {seconds}s.",
                    ephemeral=True
                )
                return
        
        # Generate a random amount
        amount = random_amount(50, 150)
        
        # Add coins
        Database.update_user_balance(user_id, amount, "add")
        self.last_work[user_id] = current_time
        
        # Generate a random work message
        work_messages = [
            f"You've worked as a programmer and earned {amount} {self.coin_emoji}",
            f"You've fixed some bugs and earned {amount} {self.coin_emoji}",
            f"You've helped a customer and earned {amount} {self.coin_emoji}",
            f"You've created a design and earned {amount} {self.coin_emoji}",
            f"You've written documentation and earned {amount} {self.coin_emoji}",
            f"You've optimized some code and earned {amount} {self.coin_emoji}",
            f"You've resolved a merge conflict and earned {amount} {self.coin_emoji}",
            f"You've deployed a new feature and earned {amount} {self.coin_emoji}",
            f"You've tested an application and earned {amount} {self.coin_emoji}",
            f"You've reviewed a pull request and earned {amount} {self.coin_emoji}"
        ]
        
        message = random.choice(work_messages)
        
        # Send success message
        await interaction.response.send_message(message)
    
    @app_commands.command(name="beg", description="Beg for ShadowIDE Coins")
    async def beg(self, interaction: discord.Interaction):
        """Beg for coins"""
        user_id = interaction.user.id
        current_time = time.time()
        
        # Check cooldown
        if user_id in self.last_beg:
            last_beg_time = self.last_beg[user_id]
            time_since_last_beg = current_time - last_beg_time
            
            # Check if 5 minutes have passed
            if time_since_last_beg < 300:
                time_remaining = 300 - time_since_last_beg
                minutes = int(time_remaining // 60)
                seconds = int(time_remaining % 60)
                
                await interaction.response.send_message(
                    f"You've begged too recently. Try again in {minutes}m {seconds}s.",
                    ephemeral=True
                )
                return
        
        # Check for luck boost
        success_chance = 85 if self.check_active_effect(user_id, "luck_boost") else 75
        
        # Check if begging is successful
        if chance(success_chance):
            # Generate a random amount
            amount = random_amount(10, 50)
            
            # Add coins
            Database.update_user_balance(user_id, amount, "add")
            
            success_messages = [
                f"Someone felt generous and gave you {amount} {self.coin_emoji}",
                f"A stranger took pity on you and gave you {amount} {self.coin_emoji}",
                f"You found {amount} {self.coin_emoji} on the ground",
                f"A rich developer donated {amount} {self.coin_emoji} to your cause",
                f"Your sad face earned you {amount} {self.coin_emoji}"
            ]
            
            message = random.choice(success_messages)
        else:
            fail_messages = [
                "Everyone ignored you. You got nothing.",
                "No one wanted to give you coins today.",
                "Try again later, maybe someone will be more generous.",
                "Your begging technique needs work. You got nothing.",
                "People gave you advice instead of coins. How useful..."
            ]
            
            message = random.choice(fail_messages)
        
        # Update cooldown
        self.last_beg[user_id] = current_time
        
        # Send message
        await interaction.response.send_message(message)
    
    @app_commands.command(name="rob", description="Attempt to rob ShadowIDE Coins from another user")
    async def rob(self, interaction: discord.Interaction, user: discord.User):
        """Rob another user"""
        robber_id = interaction.user.id
        victim_id = user.id
        current_time = time.time()
        
        # Check if user is trying to rob themselves
        if victim_id == robber_id:
            await interaction.response.send_message("You can't rob yourself.", ephemeral=True)
            return
        
        # Check if bot is being robbed
        if victim_id == self.bot.user.id:
            await interaction.response.send_message("You can't rob the bot.", ephemeral=True)
            return
        
        # Check cooldown
        if robber_id in self.last_rob:
            last_rob_time = self.last_rob[robber_id]
            time_since_last_rob = current_time - last_rob_time
            
            # Check if 1 hour has passed
            if time_since_last_rob < 3600:
                time_remaining = 3600 - time_since_last_rob
                minutes = int(time_remaining // 60)
                
                await interaction.response.send_message(
                    f"You're on the police's radar. Try again in {minutes} minutes.",
                    ephemeral=True
                )
                return
        
        # Get balances
        victim_balance = Database.get_user_balance(victim_id)
        robber_balance = Database.get_user_balance(robber_id)
        
        # Check if victim has enough coins to be robbed
        if victim_balance < 50:
            await interaction.response.send_message(
                f"{user.name} doesn't have enough coins to be worth robbing.",
                ephemeral=True
            )
            return
        
        # Check if robber has enough coins as collateral for potential fine
        if robber_balance < 50:
            await interaction.response.send_message(
                "You need at least 50 coins to attempt a robbery (potential fine).",
                ephemeral=True
            )
            return
        
        # Update cooldown
        self.last_rob[robber_id] = current_time
        
        # Check for luck boost
        success_chance = 50 if self.check_active_effect(robber_id, "luck_boost") else 35
        
        # Check if robbery is successful
        if chance(success_chance):
            # Calculate amount to steal (10-20% of victim's balance)
            steal_percentage = random.uniform(0.1, 0.2)
            amount = int(victim_balance * steal_percentage)
            amount = max(10, min(amount, 500))  # Between 10 and 500 coins
            
            # Update balances
            Database.update_user_balance(victim_id, amount, "subtract")
            Database.update_user_balance(robber_id, amount, "add")
            
            # Send success message
            await interaction.response.send_message(
                f"You successfully robbed {user.name} and got away with {amount} {self.coin_emoji}!"
            )
            
            # Send DM to victim
            embed = create_embed(
                title="You've Been Robbed!",
                description=f"{interaction.user.name} robbed you and stole {amount} {self.coin_emoji}!",
                color=discord.Color.red()
            )
            await send_dm(user, embed=embed)
        else:
            # Calculate fine (10-25% of robber's balance)
            fine_percentage = random.uniform(0.1, 0.25)
            fine = int(robber_balance * fine_percentage)
            fine = max(10, min(fine, 300))  # Between 10 and 300 coins
            
            # Update robber's balance
            Database.update_user_balance(robber_id, fine, "subtract")
            
            # Send failure message
            await interaction.response.send_message(
                f"You were caught attempting to rob {user.name} and had to pay a fine of {fine} {self.coin_emoji}!"
            )
    
    @app_commands.command(name="fish", description="Go fishing to earn coins")
    async def fish(self, interaction: discord.Interaction):
        """Go fishing to earn coins"""
        user_id = interaction.user.id
        current_time = time.time()
        
        # Check cooldown
        if user_id in self.last_fish:
            last_fish_time = self.last_fish[user_id]
            time_since_last_fish = current_time - last_fish_time
            
            # Check if 3 minutes have passed
            if time_since_last_fish < 180:
                time_remaining = 180 - time_since_last_fish
                minutes = int(time_remaining // 60)
                seconds = int(time_remaining % 60)
                
                await interaction.response.send_message(
                    f"You need to wait before fishing again. Try again in {minutes}m {seconds}s.",
                    ephemeral=True
                )
                return
        
        # Go fishing
        caught_item = None
        roll = random.random()
        cumulative_chance = 0
        
        # Check for fishing boost
        has_fishing_boost = self.check_active_effect(user_id, "fishing_boost")
        
        for item in self.fishing_items:
            # Adjust chances if user has fishing boost
            chance = item["chance"] * (1.2 if has_fishing_boost else 1.0)
            cumulative_chance += chance
            if roll <= cumulative_chance:
                caught_item = item
                break
        
        if caught_item:
            # Add coins
            Database.update_user_balance(user_id, caught_item["value"], "add")
            
            # Create embed
            embed = create_embed(
                title="🎣 Fishing",
                description=f"You caught a {caught_item['name']} and earned {caught_item['value']} {self.coin_emoji}!",
                color=discord.Color.blue()
            )
        else:
            embed = create_embed(
                title="🎣 Fishing",
                description="You didn't catch anything this time. Try again later!",
                color=discord.Color.red()
            )
        
        # Send response
        await interaction.response.send_message(embed=embed)
        
        # Update cooldown
        self.last_fish[user_id] = current_time
    
    @app_commands.command(name="mine", description="Go mining to earn coins")
    async def mine(self, interaction: discord.Interaction):
        """Go mining to earn coins"""
        user_id = interaction.user.id
        current_time = time.time()
        
        # Check cooldown
        if user_id in self.last_mine:
            last_mine_time = self.last_mine[user_id]
            time_since_last_mine = current_time - last_mine_time
            
            # Check if 3 minutes have passed
            if time_since_last_mine < 180:
                time_remaining = 180 - time_since_last_mine
                minutes = int(time_remaining // 60)
                seconds = int(time_remaining % 60)
                
                await interaction.response.send_message(
                    f"You need to wait before mining again. Try again in {minutes}m {seconds}s.",
                    ephemeral=True
                )
                return
        
        # Go mining
        mined_item = None
        roll = random.random()
        cumulative_chance = 0
        
        # Check for mining boost
        has_mining_boost = self.check_active_effect(user_id, "mining_boost")
        
        for item in self.mining_items:
            # Adjust chances if user has mining boost
            chance = item["chance"] * (1.2 if has_mining_boost else 1.0)
            cumulative_chance += chance
            if roll <= cumulative_chance:
                mined_item = item
                break
        
        if mined_item:
            # Add coins
            Database.update_user_balance(user_id, mined_item["value"], "add")
            
            # Create embed
            embed = create_embed(
                title="⛏️ Mining",
                description=f"You mined {mined_item['name']} and earned {mined_item['value']} {self.coin_emoji}!",
                color=discord.Color.blue()
            )
        else:
            embed = create_embed(
                title="⛏️ Mining",
                description="You didn't find anything this time. Try again later!",
                color=discord.Color.red()
            )
        
        # Send response
        await interaction.response.send_message(embed=embed)
        
        # Update cooldown
        self.last_mine[user_id] = current_time

    @app_commands.command(name="profile", description="View your or another user's profile")
    async def profile(self, interaction: discord.Interaction, user: Optional[discord.User] = None):
        """Display a user's profile with economy, leveling, and other stats"""
        target_user = user or interaction.user
        embed = await self.get_profile_embed(target_user.id)
        await interaction.response.send_message(embed=embed)


async def setup(bot):
    await bot.add_cog(Economy(bot)) 