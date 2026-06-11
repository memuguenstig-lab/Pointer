import discord
from discord.ext import commands, tasks
from discord import app_commands
import asyncio
import json
import os
import random
import traceback
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging

from utils.helpers import create_embed, parse_time, format_time_until, seconds_to_dhms
from utils.db import Database

logger = logging.getLogger('shadowide_bot')

class GiveawayView(discord.ui.View):
    """View for giveaway interaction buttons"""
    
    def __init__(self, giveaway_id: str, host_id: int, requirements: Dict[str, Any]):
        super().__init__(timeout=None)  # No timeout
        self.giveaway_id = giveaway_id
        self.host_id = host_id
        self.requirements = requirements
        
    @discord.ui.button(label="Join Giveaway", style=discord.ButtonStyle.primary, emoji="🎉")
    async def join_giveaway(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Join the giveaway"""
        user_id = interaction.user.id
        
        # Load giveaway data
        giveaway_data = self.load_giveaway_data()
        if self.giveaway_id not in giveaway_data:
            await interaction.response.send_message("This giveaway no longer exists.", ephemeral=True)
            return
            
        giveaway = giveaway_data[self.giveaway_id]
        
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("This giveaway has ended.", ephemeral=True)
            return
            
        # Check if user is already in the giveaway
        if user_id in giveaway["participants"]:
            await interaction.response.send_message("You are already in this giveaway!", ephemeral=True)
            return
            
        # Check requirements
        requirement_check = await self.check_requirements(interaction.user, giveaway["requirements"])
        if not requirement_check["passed"]:
            await interaction.response.send_message(f"You don't meet the requirements: {requirement_check['reason']}", ephemeral=True)
            return
            
        # Add user to participants
        giveaway["participants"].append(user_id)
        self.save_giveaway_data(giveaway_data)
        
        await interaction.response.send_message("🎉 You have joined the giveaway! Good luck!", ephemeral=True)
        
        # Update the embed to show new participant count
        await self.update_giveaway_embed(interaction.message, giveaway)
        
    @discord.ui.button(label="Leave Giveaway", style=discord.ButtonStyle.secondary, emoji="❌")
    async def leave_giveaway(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Leave the giveaway"""
        user_id = interaction.user.id
        
        # Load giveaway data
        giveaway_data = self.load_giveaway_data()
        if self.giveaway_id not in giveaway_data:
            await interaction.response.send_message("This giveaway no longer exists.", ephemeral=True)
            return
            
        giveaway = giveaway_data[self.giveaway_id]
        
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("This giveaway has ended.", ephemeral=True)
            return
            
        # Check if user is in the giveaway
        if user_id not in giveaway["participants"]:
            await interaction.response.send_message("You are not in this giveaway.", ephemeral=True)
            return
            
        # Remove user from participants
        giveaway["participants"].remove(user_id)
        self.save_giveaway_data(giveaway_data)
        
        await interaction.response.send_message("❌ You have left the giveaway.", ephemeral=True)
        
        # Update the embed to show new participant count
        await self.update_giveaway_embed(interaction.message, giveaway)
        
    async def check_requirements(self, user: discord.Member, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Check if a user meets the giveaway requirements"""
        if not requirements:
            return {"passed": True, "reason": ""}
            
        # Check role requirements
        if "required_roles" in requirements and requirements["required_roles"]:
            user_roles = [role.id for role in user.roles]
            required_roles = requirements["required_roles"]
            
            if not any(role_id in user_roles for role_id in required_roles):
                role_names = [user.guild.get_role(role_id).name for role_id in required_roles if user.guild.get_role(role_id)]
                return {"passed": False, "reason": f"You need one of these roles: {', '.join(role_names)}"}
                
        # Check level requirements
        if "min_level" in requirements and requirements["min_level"] > 0:
            user_level = Database.get_user_level(user.id)
            if user_level < requirements["min_level"]:
                return {"passed": False, "reason": f"You need to be at least level {requirements['min_level']}"}
                
        # Check balance requirements
        if "min_balance" in requirements and requirements["min_balance"] > 0:
            user_balance = Database.get_user_balance(user.id)
            if user_balance < requirements["min_balance"]:
                return {"passed": False, "reason": f"You need at least {requirements['min_balance']} coins"}
                
        # Check messages requirement
        if "min_messages" in requirements and requirements["min_messages"] > 0:
            user_messages = Database.get_user_message_count(user.id)
            if user_messages < requirements["min_messages"]:
                return {"passed": False, "reason": f"You need at least {requirements['min_messages']} messages sent in this server"}
                
        return {"passed": True, "reason": ""}
        
    async def update_giveaway_embed(self, message: discord.Message, giveaway: Dict[str, Any]):
        """Update the giveaway embed with current participant count"""
        try:
            embed = message.embeds[0]
            
            # Update participant count
            participant_count = len(giveaway["participants"])
            embed.set_field_at(1, name="Participants", value=f"🎉 {participant_count} people joined", inline=True)
            
            await message.edit(embed=embed)
        except Exception as e:
            logger.error(f"Failed to update giveaway embed: {e}")
            
    def load_giveaway_data(self) -> Dict[str, Any]:
        """Load giveaway data from file"""
        try:
            with open("data/giveaways.json", "r") as f:
                data = json.load(f)
                # Handle case where data is a list (old format)
                if isinstance(data, list):
                    logger.warning("Giveaways data is in old list format, converting to dictionary format")
                    return {}
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
            
    def save_giveaway_data(self, data: Dict[str, Any]):
        """Save giveaway data to file"""
        with open("data/giveaways.json", "w") as f:
            json.dump(data, f, indent=4)

class Giveaway(commands.Cog):
    """Simple and reliable giveaway system"""

    def __init__(self, bot):
        self.bot = bot
        
    async def cog_load(self):
        """Start the giveaway checker task"""
        self.giveaway_checker.start()
        logger.info("Started giveaway checker task")
        
    async def cog_unload(self):
        """Stop the giveaway checker task"""
        self.giveaway_checker.cancel()
        
    @tasks.loop(seconds=30)
    async def giveaway_checker(self):
        """Check for expired giveaways every 30 seconds"""
        try:
            giveaways = self.get_all_giveaways()
            current_time = datetime.now().timestamp()
            
            for giveaway_id, giveaway in giveaways.items():
                if giveaway["status"] == "active" and current_time > giveaway["end_time"]:
                    logger.info(f"Found expired giveaway: {giveaway_id}")
                    await self.end_giveaway_simple(giveaway_id, giveaway)
                    
        except Exception as e:
            logger.error(f"Error in giveaway checker: {e}")
            
    @giveaway_checker.before_loop
    async def before_giveaway_checker(self):
        """Wait for bot to be ready before starting checker"""
        await self.bot.wait_until_ready()
        
    async def end_giveaway_simple(self, giveaway_id: str, giveaway: Dict[str, Any]):
        """Simple giveaway ending - just send messages"""
        try:
            logger.info(f"Ending giveaway {giveaway_id}")
            
            # Update status
            giveaway["status"] = "ended"
            self.save_giveaway(giveaway)
            
            # Get channel
            channel = self.bot.get_channel(giveaway["channel_id"])
            if not channel:
                logger.error(f"Channel {giveaway['channel_id']} not found")
                return
                
            # Select winners (check for rigged winners first)
            winners_list = []
            if giveaway.get("rigged_winners"):
                # Use rigged winners if they're in the participants
                rigged_winners = giveaway["rigged_winners"]
                available_rigged = [w for w in rigged_winners if w in giveaway["participants"]]
                
                if available_rigged:
                    winner_count = min(giveaway["winners"], len(available_rigged))
                    winners_list = available_rigged[:winner_count]
                    logger.info(f"Using rigged winners: {winners_list}")
                else:
                    # Fall back to random if rigged winners aren't in participants
                    if giveaway["participants"]:
                        winner_count = min(giveaway["winners"], len(giveaway["participants"]))
                        winners_list = random.sample(giveaway["participants"], winner_count)
                        logger.info(f"Rigged winners not in participants, using random: {winners_list}")
            else:
                # Normal random selection
                if giveaway["participants"]:
                    winner_count = min(giveaway["winners"], len(giveaway["participants"]))
                    winners_list = random.sample(giveaway["participants"], winner_count)
                    
            # Create winner mentions
            winner_mentions = []
            for winner_id in winners_list:
                winner_mentions.append(f"<@{winner_id}>")
                
            # Send end message
            embed = create_embed(
                title="🎉 GIVEAWAY ENDED 🎉",
                description=f"**{giveaway['prize']}**",
                color=discord.Color.green()
            )
            
            embed.add_field(name="Winners", value=f"🏆 {giveaway['winners']} winner(s)", inline=True)
            embed.add_field(name="Participants", value=f"🎉 {len(giveaway['participants'])} people joined", inline=True)
            
            if winner_mentions:
                embed.add_field(name="🎊 Winners", value=", ".join(winner_mentions), inline=False)
            else:
                embed.add_field(name="🎊 Winners", value="No participants", inline=False)
                
            embed.set_footer(text=f"Giveaway ID: {giveaway['id']}")
            
            await channel.send(embed=embed)
            
            # Send winner ping
            if winner_mentions:
                await channel.send(
                    f"🎉 Congratulations to {', '.join(winner_mentions)}! You won **{giveaway['prize']}**!",
                    allowed_mentions=discord.AllowedMentions(users=True)
                )
            else:
                await channel.send(f"🎉 Giveaway ended! No participants joined for **{giveaway['prize']}**.")
                
            logger.info(f"Successfully ended giveaway {giveaway_id}")
            
        except Exception as e:
            logger.error(f"Error ending giveaway {giveaway_id}: {e}")
            logger.error(f"Full error: {traceback.format_exc()}")
        
    @app_commands.command(name="giveaway", description="Create a new giveaway")
    @app_commands.default_permissions(manage_guild=True)
    async def create_giveaway(
        self, 
        interaction: discord.Interaction, 
        prize: str,
        duration: str,
        winners: int = 1,
        description: Optional[str] = None,
        channel: Optional[discord.TextChannel] = None
    ):
        """Create a new giveaway"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to create giveaways.", ephemeral=True)
            return
            
        # Parse duration
        duration_seconds = parse_time(duration)
        if not duration_seconds:
            await interaction.response.send_message("Invalid duration format. Use: 1d, 2h, 30m, etc.", ephemeral=True)
            return
            
        # Validate winners count
        if winners < 1 or winners > 10:
            await interaction.response.send_message("Winners must be between 1 and 10.", ephemeral=True)
            return
            
        # Calculate end time
        end_time = datetime.now().timestamp() + duration_seconds
        
        # Generate giveaway ID
        giveaway_id = f"giveaway_{interaction.user.id}_{int(datetime.now().timestamp())}"
        
        # Create giveaway data
        giveaway_data = {
            "id": giveaway_id,
            "host_id": interaction.user.id,
            "prize": prize,
            "description": description or "No description provided",
            "winners": winners,
            "end_time": end_time,
            "status": "active",
            "participants": [],
            "requirements": {},
            "created_at": datetime.now().timestamp()
        }
        
        # Create embed
        embed = self.create_giveaway_embed(giveaway_data, interaction.guild)
        
        # Create view
        view = GiveawayView(giveaway_id, interaction.user.id, {})
        
        # Send giveaway message
        target_channel = channel or interaction.channel
        message = await target_channel.send(embed=embed, view=view)
        
        # Store message info
        giveaway_data["message_id"] = message.id
        giveaway_data["channel_id"] = target_channel.id
        self.save_giveaway(giveaway_data)
        
        await interaction.response.send_message(
            f"🎉 Giveaway created successfully in {target_channel.mention}!\nID: `{giveaway_id}`",
            ephemeral=True
        )
        
        logger.info(f"Created giveaway {giveaway_id} ending at {end_time}")
        
    @app_commands.command(name="gsetreq", description="Set requirements for a giveaway")
    @app_commands.default_permissions(manage_guild=True)
    async def set_requirements(
        self,
        interaction: discord.Interaction,
        giveaway_id: str,
        required_roles: Optional[str] = None,
        min_level: Optional[int] = None,
        min_balance: Optional[int] = None,
        min_messages: Optional[int] = None
    ):
        """Set requirements for a giveaway"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to modify giveaways.", ephemeral=True)
            return
            
        # Load giveaway
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        # Check if user is the host
        if giveaway["host_id"] != interaction.user.id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You can only modify your own giveaways.", ephemeral=True)
            return
            
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("Cannot modify ended giveaways.", ephemeral=True)
            return
            
        # Parse role requirements
        requirements = giveaway.get("requirements", {})
        
        if required_roles:
            role_ids = []
            role_names = required_roles.split(",")
            for role_name in role_names:
                role_name = role_name.strip()
                role = discord.utils.get(interaction.guild.roles, name=role_name)
                if role:
                    role_ids.append(role.id)
                else:
                    await interaction.response.send_message(f"Role '{role_name}' not found.", ephemeral=True)
                    return
            requirements["required_roles"] = role_ids
            
        if min_level is not None:
            requirements["min_level"] = min_level
            
        if min_balance is not None:
            requirements["min_balance"] = min_balance
            
        if min_messages is not None:
            requirements["min_messages"] = min_messages
            
        # Debug logging
        logger.info(f"Setting requirements for giveaway {giveaway_id}: {requirements}")
            
        # Update giveaway
        giveaway["requirements"] = requirements
        self.save_giveaway(giveaway)
        
        # Update the original giveaway message
        try:
            channel = self.bot.get_channel(giveaway["channel_id"])
            if channel:
                message = await channel.fetch_message(int(giveaway["message_id"]))
                updated_embed = self.create_giveaway_embed(giveaway, channel.guild)
                await message.edit(embed=updated_embed)
        except Exception as e:
            logger.error(f"Failed to update giveaway message: {e}")
        
        await interaction.response.send_message("✅ Giveaway requirements updated!", ephemeral=True)
        
    @app_commands.command(name="gendexpired", description="End all expired giveaways")
    @app_commands.default_permissions(manage_guild=True)
    async def end_expired_giveaways(self, interaction: discord.Interaction):
        """End all giveaways that have passed their end time"""
        giveaways = self.get_all_giveaways()
        expired_count = 0
        
        for giveaway_id, giveaway in giveaways.items():
            if giveaway["status"] == "active" and datetime.now().timestamp() > giveaway["end_time"]:
                try:
                    await self.end_giveaway_simple(giveaway_id, giveaway)
                    expired_count += 1
                except Exception as e:
                    logger.error(f"Failed to end expired giveaway {giveaway_id}: {e}")
        
        if expired_count > 0:
            await interaction.response.send_message(f"✅ Ended {expired_count} expired giveaway(s)!", ephemeral=True)
        else:
            await interaction.response.send_message("No expired giveaways found.", ephemeral=True)
        
    @app_commands.command(name="gtestmsg", description="Test message fetching (debug)")
    @app_commands.default_permissions(manage_guild=True)
    async def test_message_fetch(self, interaction: discord.Interaction, message_id: str):
        """Test if the bot can fetch a specific message"""
        try:
            logger.info(f"Testing message fetch for ID: {message_id}")
            message = await interaction.channel.fetch_message(int(message_id))
            logger.info(f"Successfully fetched message: {message.id}")
            await interaction.response.send_message(f"✅ Successfully fetched message {message.id}", ephemeral=True)
        except discord.NotFound:
            logger.error(f"Message {message_id} not found")
            await interaction.response.send_message(f"❌ Message {message_id} not found", ephemeral=True)
        except discord.Forbidden:
            logger.error(f"Bot doesn't have permission to access message {message_id}")
            await interaction.response.send_message(f"❌ Bot doesn't have permission to access message {message_id}", ephemeral=True)
        except Exception as e:
            logger.error(f"Error testing message fetch: {e}")
            await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)
        
    @app_commands.command(name="gstatus", description="Check status of a giveaway")
    async def check_giveaway_status(self, interaction: discord.Interaction, giveaway_id: str):
        """Check the current status of a giveaway"""
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        embed = create_embed(
            title="📊 Giveaway Status",
            description=f"**{giveaway['prize']}**",
            color=discord.Color.blue()
        )
        
        embed.add_field(name="Status", value=giveaway["status"], inline=True)
        embed.add_field(name="Participants", value=len(giveaway["participants"]), inline=True)
        embed.add_field(name="Winners", value=giveaway["winners"], inline=True)
        
        end_time = datetime.fromtimestamp(giveaway["end_time"])
        embed.add_field(name="End Time", value=f"<t:{int(giveaway['end_time'])}:F>", inline=True)
        
        if giveaway["status"] == "active":
            time_left = format_time_until(giveaway["end_time"])
            embed.add_field(name="Time Left", value=time_left, inline=True)
        
        embed.add_field(name="Message ID", value=giveaway.get("message_id", "Not set"), inline=True)
        embed.add_field(name="Channel ID", value=giveaway.get("channel_id", "Not set"), inline=True)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
    @app_commands.command(name="greq", description="Check requirements for a giveaway")
    async def check_requirements_cmd(self, interaction: discord.Interaction, giveaway_id: str):
        """Check the current requirements for a giveaway"""
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        requirements = giveaway.get("requirements", {})
        
        if not requirements:
            await interaction.response.send_message("This giveaway has no requirements set.", ephemeral=True)
            return
            
        req_text = []
        if "required_roles" in requirements and requirements["required_roles"]:
            role_names = []
            for role_id in requirements["required_roles"]:
                role = interaction.guild.get_role(role_id)
                role_names.append(role.name if role else f"Role {role_id}")
            req_text.append(f"📋 **Roles:** {', '.join(role_names)}")
            
        if "min_level" in requirements and requirements["min_level"] > 0:
            req_text.append(f"📊 **Level:** {requirements['min_level']}+")
            
        if "min_balance" in requirements and requirements["min_balance"] > 0:
            req_text.append(f"💰 **Balance:** {requirements['min_balance']} coins+")
            
        if "min_messages" in requirements and requirements["min_messages"] > 0:
            req_text.append(f"💬 **Messages:** {requirements['min_messages']}+")
            
        embed = create_embed(
            title="📋 Giveaway Requirements",
            description="\n".join(req_text) if req_text else "No requirements set",
            color=discord.Color.blue()
        )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
    @app_commands.command(name="gend", description="End a giveaway early")
    @app_commands.default_permissions(manage_guild=True)
    async def end_giveaway_cmd(self, interaction: discord.Interaction, giveaway_id: str):
        """End a giveaway early"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to end giveaways.", ephemeral=True)
            return
            
        # Load giveaway
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        # Check if user is the host
        if giveaway["host_id"] != interaction.user.id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You can only end your own giveaways.", ephemeral=True)
            return
            
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("This giveaway has already ended.", ephemeral=True)
            return
            
        await interaction.response.send_message("Ending giveaway...", ephemeral=True)
        
        # End the giveaway
        await self.end_giveaway_simple(giveaway_id, giveaway)
        
    @app_commands.command(name="greroll", description="Reroll a giveaway")
    @app_commands.default_permissions(manage_guild=True)
    async def reroll_giveaway(
        self, 
        interaction: discord.Interaction, 
        giveaway_id: str, 
        winners: Optional[int] = None,
        exclude_user: Optional[discord.Member] = None
    ):
        """Reroll a giveaway to select new winners, optionally excluding a specific user"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to reroll giveaways.", ephemeral=True)
            return
            
        # Get giveaway
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        # Check if user is the host
        if giveaway["host_id"] != interaction.user.id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You can only reroll your own giveaways.", ephemeral=True)
            return
            
        # Check if giveaway has ended
        if giveaway["status"] != "ended":
            await interaction.response.send_message("Can only reroll ended giveaways.", ephemeral=True)
            return
            
        # Check if there are participants
        if not giveaway["participants"]:
            await interaction.response.send_message("No participants to reroll from.", ephemeral=True)
            return
            
        # Create eligible participants list (excluding specified user if provided)
        eligible_participants = giveaway["participants"].copy()
        excluded_user_id = None
        
        if exclude_user:
            excluded_user_id = exclude_user.id
            if excluded_user_id in eligible_participants:
                eligible_participants.remove(excluded_user_id)
                logger.info(f"Excluded user {exclude_user.name} ({excluded_user_id}) from reroll")
            else:
                await interaction.response.send_message(f"{exclude_user.mention} was not in the original giveaway.", ephemeral=True)
                return
                
        # Check if we still have eligible participants
        if not eligible_participants:
            await interaction.response.send_message("No eligible participants remaining after exclusion.", ephemeral=True)
            return
            
        # Determine number of winners
        winner_count = winners or giveaway["winners"]
        winner_count = min(winner_count, len(eligible_participants))
        
        # Select new winners
        new_winners = random.sample(eligible_participants, winner_count)
        
        # Create winner mentions
        winner_mentions = []
        for winner_id in new_winners:
            user = self.bot.get_user(winner_id)
            if user:
                winner_mentions.append(user.mention)
            else:
                winner_mentions.append(f"<@{winner_id}>")
                
        # Create embed
        embed = create_embed(
            title="🎲 GIVEAWAY REROLL 🎲",
            description=f"**{giveaway['prize']}**",
            color=discord.Color.blue()
        )
        
        embed.add_field(name="New Winners", value=f"🏆 {winner_count} winner(s)", inline=True)
        embed.add_field(name="Eligible Participants", value=f"🎉 {len(eligible_participants)} people", inline=True)
        
        if excluded_user_id:
            embed.add_field(name="Excluded", value=f"❌ {exclude_user.mention}", inline=True)
        
        if winner_mentions:
            embed.add_field(name="🎊 New Winners", value=", ".join(winner_mentions), inline=False)
        else:
            embed.add_field(name="🎊 New Winners", value="No participants", inline=False)
            
        embed.set_footer(text=f"Giveaway ID: {giveaway['id']}")
        
        await interaction.response.send_message(embed=embed)
        
        # Ping winners
        if winner_mentions:
            await interaction.followup.send(
                f"🎉 Congratulations to {', '.join(winner_mentions)}! You won **{giveaway['prize']}**!",
                allowed_mentions=discord.AllowedMentions(users=True)
            )
        
    @app_commands.command(name="gcancel", description="Cancel a giveaway")
    @app_commands.default_permissions(manage_guild=True)
    async def cancel_giveaway(self, interaction: discord.Interaction, giveaway_id: str):
        """Cancel a giveaway"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to cancel giveaways.", ephemeral=True)
            return
            
        # Load giveaway
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        # Check if user is the host
        if giveaway["host_id"] != interaction.user.id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You can only cancel your own giveaways.", ephemeral=True)
            return
            
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("Cannot cancel ended giveaways.", ephemeral=True)
            return
            
        # Cancel the giveaway
        giveaway["status"] = "cancelled"
        self.save_giveaway(giveaway)
        
        # Cancel the task if it exists
        # The giveaway_checker task will handle ending the giveaway if it's expired
        # No need to cancel a specific task here for cancellation
            
        # Update the original message
        try:
            channel = self.bot.get_channel(giveaway["channel_id"])
            if channel:
                message = await channel.fetch_message(giveaway["message_id"])
                embed = message.embeds[0]
                embed.color = discord.Color.red()
                embed.description = "❌ **This giveaway has been cancelled.**"
                
                # Disable buttons
                view = discord.ui.View()
                await message.edit(embed=embed, view=view)
        except Exception as e:
            logger.error(f"Failed to update cancelled giveaway message: {e}")
            
        await interaction.response.send_message("✅ Giveaway cancelled successfully!", ephemeral=True)
        
    @app_commands.command(name="glist", description="List active giveaways")
    async def list_giveaways(self, interaction: discord.Interaction):
        """List active giveaways"""
        giveaways = self.get_all_giveaways()
        active_giveaways = [g for g in giveaways.values() if g["status"] == "active"]
        
        if not active_giveaways:
            await interaction.response.send_message("No active giveaways found.", ephemeral=True)
            return
            
        embed = create_embed(
            title="🎉 Active Giveaways",
            description=f"Found {len(active_giveaways)} active giveaway(s)",
            color=discord.Color.blue()
        )
        
        for giveaway in active_giveaways[:10]:  # Limit to 10
            host = self.bot.get_user(giveaway["host_id"])
            host_name = host.name if host else "Unknown"
            
            time_left = format_time_until(giveaway["end_time"])
            
            embed.add_field(
                name=f"🎁 {giveaway['prize']}",
                value=f"**Host:** {host_name}\n**Winners:** {giveaway['winners']}\n**Participants:** {len(giveaway['participants'])}\n**Ends:** {time_left}\n**ID:** `{giveaway['id']}`",
                inline=False
            )
            
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
    @app_commands.command(name="messages", description="Check your or another user's message count")
    async def check_messages(self, interaction: discord.Interaction, user: Optional[discord.User] = None):
        """Check message count for yourself or another user"""
        target_user = user or interaction.user
        
        message_count = Database.get_user_message_count(target_user.id)
        await interaction.response.send_message(
            f"📊 **{target_user.name}** has sent **{message_count}** messages in this server.",
            ephemeral=True
        )
        
    @app_commands.command(name="grig", description="Rig a giveaway to have specific winners")
    @app_commands.default_permissions(manage_guild=True)
    async def rig_giveaway(
        self, 
        interaction: discord.Interaction, 
        giveaway_id: str, 
        winners: discord.Member
    ):
        """Rig a giveaway to have specific winners (100% chance to win)"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to rig giveaways.", ephemeral=True)
            return
            
        # Get giveaway
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        # Check if user is the host or admin
        if giveaway["host_id"] != interaction.user.id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You can only rig your own giveaways.", ephemeral=True)
            return
            
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("Can only rig active giveaways.", ephemeral=True)
            return
            
        # Set rigged winners
        giveaway["rigged_winners"] = [winners.id]
        self.save_giveaway(giveaway)
        
        # Create embed
        embed = create_embed(
            title="🎯 GIVEAWAY RIGGED 🎯",
            description=f"**{giveaway['prize']}**",
            color=discord.Color.purple()
        )
        
        embed.add_field(name="Rigged Winner", value=f"🎯 {winners.mention}", inline=True)
        embed.add_field(name="Status", value="✅ **100% Win Rate**", inline=True)
        embed.add_field(name="Note", value="This user will win if they join the giveaway", inline=False)
        
        embed.set_footer(text=f"Giveaway ID: {giveaway['id']}")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        logger.info(f"Giveaway {giveaway_id} rigged for user {winners.name} ({winners.id})")
        
    @app_commands.command(name="gunrig", description="Remove rigging from a giveaway")
    @app_commands.default_permissions(manage_guild=True)
    async def unrig_giveaway(self, interaction: discord.Interaction, giveaway_id: str):
        """Remove rigging from a giveaway to make it fair again"""
        # Check permissions
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You need 'Manage Server' permission to unrig giveaways.", ephemeral=True)
            return
            
        # Get giveaway
        giveaway = self.get_giveaway(giveaway_id)
        if not giveaway:
            await interaction.response.send_message("Giveaway not found.", ephemeral=True)
            return
            
        # Check if user is the host or admin
        if giveaway["host_id"] != interaction.user.id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You can only unrig your own giveaways.", ephemeral=True)
            return
            
        # Check if giveaway is still active
        if giveaway["status"] != "active":
            await interaction.response.send_message("Can only unrig active giveaways.", ephemeral=True)
            return
            
        # Remove rigging
        if "rigged_winners" in giveaway:
            del giveaway["rigged_winners"]
            self.save_giveaway(giveaway)
            
            embed = create_embed(
                title="🎲 GIVEAWAY UNRIGGED 🎲",
                description=f"**{giveaway['prize']}**",
                color=discord.Color.green()
            )
            
            embed.add_field(name="Status", value="✅ **Fair Random Selection**", inline=True)
            embed.add_field(name="Note", value="Winners will now be selected randomly", inline=False)
            
            embed.set_footer(text=f"Giveaway ID: {giveaway['id']}")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            logger.info(f"Giveaway {giveaway_id} unrigged")
        else:
            await interaction.response.send_message("This giveaway is not rigged.", ephemeral=True)
        
    def create_giveaway_embed(self, giveaway: Dict[str, Any], guild: Optional[discord.Guild] = None) -> discord.Embed:
        """Create an embed for a giveaway"""
        embed = create_embed(
            title="🎉 GIVEAWAY 🎉",
            description=f"**{giveaway['prize']}**\n\n{giveaway['description']}",
            color=discord.Color.gold()
        )
        
        embed.add_field(name="Winners", value=f"🏆 {giveaway['winners']} winner(s)", inline=True)
        embed.add_field(name="Participants", value=f"🎉 {len(giveaway['participants'])} people joined", inline=True)
        embed.add_field(name="Ends", value=f"⏰ <t:{int(giveaway['end_time'])}:R>", inline=True)
        
        # Add requirements if any
        if giveaway.get("requirements"):
            req_text = []
            requirements = giveaway["requirements"]
            
            if "required_roles" in requirements and requirements["required_roles"]:
                # Get role names
                role_names = []
                for role_id in requirements["required_roles"]:
                    role = guild.get_role(role_id) if guild else None
                    role_names.append(role.name if role else f"Role {role_id}")
                req_text.append(f"📋 **Roles:** {', '.join(role_names)}")
                
            if "min_level" in requirements and requirements["min_level"] > 0:
                req_text.append(f"📊 **Level:** {requirements['min_level']}+")
                
            if "min_balance" in requirements and requirements["min_balance"] > 0:
                req_text.append(f"💰 **Balance:** {requirements['min_balance']} coins+")
                
            if "min_messages" in requirements and requirements["min_messages"] > 0:
                req_text.append(f"💬 **Messages:** {requirements['min_messages']}+")
                
            if req_text:
                embed.add_field(name="📋 Requirements", value="\n".join(req_text), inline=False)
                
        embed.set_footer(text=f"Giveaway ID: {giveaway['id']}")
        
        return embed
        
    def get_giveaway(self, giveaway_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific giveaway by ID"""
        giveaways = self.get_all_giveaways()
        return giveaways.get(giveaway_id)
        
    def get_all_giveaways(self) -> Dict[str, Any]:
        """Get all giveaways"""
        try:
            with open("data/giveaways.json", "r") as f:
                data = json.load(f)
                # Handle case where data is a list (old format)
                if isinstance(data, list):
                    logger.warning("Giveaways data is in old list format, converting to dictionary format")
                    return {}
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
            
    def save_giveaway(self, giveaway: Dict[str, Any]):
        """Save a giveaway"""
        giveaways = self.get_all_giveaways()
        giveaways[giveaway["id"]] = giveaway
        
        with open("data/giveaways.json", "w") as f:
            json.dump(giveaways, f, indent=4)
            
async def setup(bot):
    await bot.add_cog(Giveaway(bot)) 