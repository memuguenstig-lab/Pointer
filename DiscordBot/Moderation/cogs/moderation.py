import discord
from discord import app_commands
from discord.ext import commands, tasks
from discord.ui import Button, View
import asyncio
import datetime
import logging
from typing import Optional, List, Union

from utils.db import Database
from utils.time_converter import parse_time_string, get_future_timestamp, get_formatted_timestamp
from utils.logger import log_to_channel

logger = logging.getLogger('shadowide_bot')

class Moderation(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db = Database()
        self.check_expired_punishments.start()
        self.start_time = datetime.datetime.now(datetime.timezone.utc)
        
        # Anti-spam tracking
        self.message_timestamps = {}  # {user_id: [timestamp1, timestamp2, ...]}
        self.spam_warnings = {}  # {user_id: warning_count}
        self.mute_durations = {}  # {user_id: current_mute_duration}
        self.last_warning_time = {}  # {user_id: timestamp}
    
    def cog_unload(self):
        """Called when the cog is unloaded."""
        self.check_expired_punishments.cancel()
        self.db.close()
        self.message_timestamps.clear()
        self.spam_warnings.clear()
        self.mute_durations.clear()
        self.last_warning_time.clear()
    
    async def send_dm(self, user: discord.User, action: str, guild_name: str, 
                     reason: Optional[str] = None, duration: Optional[str] = None):
        """Send a DM to a user about a moderation action."""
        try:
            # Select appropriate color and emoji based on action
            color_map = {
                "banned": discord.Color.red(),
                "kicked": discord.Color.orange(),
                "muted": discord.Color.gold(),
                "warned": discord.Color.yellow(),
                "unbanned": discord.Color.green(),
                "unmuted": discord.Color.green()
            }
            
            emoji_map = {
                "banned": "🔨",
                "kicked": "👢",
                "muted": "🔇",
                "warned": "⚠️",
                "unbanned": "🔓",
                "unmuted": "🔊"
            }
            
            color = color_map.get(action, discord.Color.blue())
            emoji = emoji_map.get(action, "📢")
            
            embed = discord.Embed(
                title=f"{emoji} ShadowIDE Discord Moderation",
                description=f"You have been **{action}** from **{guild_name}**",
                color=color,
                timestamp=datetime.datetime.now()
            )
            
            if reason:
                embed.add_field(name="📝 Reason", value=reason or "No reason provided", inline=False)
            
            # Handle duration and expiry time
            if duration:
                # For temporary actions (mutes and bans)
                if action in ["banned", "muted"]:
                    time_delta, _ = parse_time_string(duration)
                    if time_delta:
                        # Calculate expiry time
                        end_timestamp = get_future_timestamp(time_delta)
                        
                        # Add duration field
                        embed.add_field(name="⏱️ Duration", value=duration, inline=False)
                        
                        # Add separate expiry field with both absolute and relative time
                        formatted_time = get_formatted_timestamp(end_timestamp, "F")  # Full date and time
                        relative_time = get_formatted_timestamp(end_timestamp, "R")   # Relative time
                        
                        embed.add_field(
                            name="⌛ Expires",
                            value=f"{formatted_time}\n{relative_time}",
                            inline=False
                        )
                    else:
                        # Fallback if we can't parse the duration
                        embed.add_field(name="⏱️ Duration", value=duration or "Permanent", inline=False)
                else:
                    # For other actions
                    embed.add_field(name="⏱️ Duration", value=duration or "Permanent", inline=False)
            
            # Add footer with timestamp
            embed.set_footer(text="ShadowIDE Moderation System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
            
            await user.send(embed=embed)
            return True
        except (discord.Forbidden, discord.HTTPException):
            # User has DMs disabled or another error occurred
            logger.warning(f"Failed to send DM to {user.name}#{user.discriminator} ({user.id})")
            return False
    
    async def create_log_embed(self, action: str, target: Union[discord.Member, discord.User], 
                              moderator: discord.Member, reason: Optional[str] = None, 
                              duration: Optional[str] = None) -> discord.Embed:
        """Create an embed for logging a moderation action."""
        # Define colors and emojis for different actions
        color_map = {
            "Ban": discord.Color.dark_red(),
            "Temporary Ban": discord.Color.red(),
            "Unban": discord.Color.green(),
            "Kick": discord.Color.orange(),
            "Mute": discord.Color.gold(),
            "Unmute": discord.Color.green(),
            "Warning": discord.Color.yellow(),
            "Clear": discord.Color.blue(),
            "Lock": discord.Color.dark_red(),
            "Unlock": discord.Color.green()
        }
        
        emoji_map = {
            "Ban": "🔨",
            "Temporary Ban": "⏱️🔨",
            "Unban": "🔓",
            "Kick": "👢",
            "Mute": "🔇",
            "Unmute": "🔊",
            "Warning": "⚠️",
            "Clear": "🧹",
            "Lock": "🔒",
            "Unlock": "🔓"
        }
        
        color = color_map.get(action, discord.Color.blue())
        emoji = emoji_map.get(action, "")
        
        embed = discord.Embed(
            title=f"{emoji} {action} | {target.name}",
            color=color,
            timestamp=datetime.datetime.now()
        )
        
        # Set thumbnail to user avatar
        embed.set_thumbnail(url=target.display_avatar.url)
        
        # Add fields
        embed.add_field(name="👤 User", value=f"{target.mention} (`{target.id}`)", inline=True)
        embed.add_field(name="🛡️ Moderator", value=f"{moderator.mention} (`{moderator.id}`)", inline=True)
        
        if reason:
            embed.add_field(name="📝 Reason", value=reason or "No reason provided", inline=False)
        
        if duration:
            embed.add_field(name="⏱️ Duration", value=duration or "Permanent", inline=False)
        
        # Set footer
        embed.set_footer(text=f"User ID: {target.id} | ShadowIDE Moderation", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        return embed
    
    async def ensure_mute_role(self, guild: discord.Guild) -> discord.Role:
        """Ensure that the muted role exists and is properly set up."""
        # Look for existing "Muted" role
        muted_role = discord.utils.get(guild.roles, name="Muted")
        
        # If the role doesn't exist, create it
        if not muted_role:
            try:
                # Create the role
                muted_role = await guild.create_role(
                    name="Muted",
                    reason="Creating muted role for moderation system"
                )
                
                # Set role permissions for all channels
                for channel in guild.channels:
                    try:
                        perms = channel.overwrites_for(muted_role)
                        perms.send_messages = False
                        perms.add_reactions = False
                        perms.speak = False
                        await channel.set_permissions(
                            muted_role,
                            overwrite=perms,
                            reason="Setting up muted role permissions"
                        )
                    except discord.Forbidden:
                        logger.warning(f"Missing permissions to modify channel {channel.name}")
                    except discord.HTTPException as e:
                        logger.error(f"Error setting up permissions for channel {channel.name}: {e}")
                
                logger.info(f"Created 'Muted' role in {guild.name}")
            except discord.Forbidden:
                logger.error(f"Missing permissions to create 'Muted' role in {guild.name}")
            except discord.HTTPException as e:
                logger.error(f"Error creating 'Muted' role in {guild.name}: {e}")
        
        return muted_role
    
    @tasks.loop(minutes=1)
    async def check_expired_punishments(self):
        """Check for expired temporary bans and mutes."""
        current_time = int(datetime.datetime.now().timestamp())
        
        # Check expired bans
        expired_bans = self.db.get_expired_bans(current_time)
        for user_id, guild_id in expired_bans:
            guild = self.bot.get_guild(guild_id)
            if guild:
                try:
                    # Unban the user
                    user = await self.bot.fetch_user(user_id)
                    await guild.unban(user, reason="Temporary ban expired")
                    
                    # Remove from database
                    self.db.remove_temp_ban(user_id)
                    
                    # Log the action
                    embed = discord.Embed(
                        title=f"🔓 Unban | {user.name}",
                        description=f"Temporary ban expired for {user.mention} (`{user.id}`)",
                        color=discord.Color.green(),
                        timestamp=datetime.datetime.now()
                    )
                    embed.add_field(name="📅 Expired", value=f"<t:{current_time}:F>", inline=True)
                    embed.set_footer(text=f"User ID: {user.id} | ShadowIDE Moderation", icon_url="https://shadowide.f1shy312.com/static/logo.png")
                    await log_to_channel(self.bot, embed)
                    
                    # Try to DM the user
                    await self.send_dm(
                        user, 
                        "unbanned", 
                        guild.name, 
                        "Temporary ban expired", 
                        None
                    )
                    
                    logger.info(f"Unbanned {user.name} ({user.id}) from {guild.name} due to expired ban")
                except (discord.Forbidden, discord.HTTPException) as e:
                    logger.error(f"Error unbanning user {user_id} from {guild.name}: {e}")
        
        # Check expired mutes
        expired_mutes = self.db.get_expired_mutes(current_time)
        for user_id, guild_id in expired_mutes:
            guild = self.bot.get_guild(guild_id)
            if guild:
                try:
                    # Get the muted role
                    muted_role = discord.utils.get(guild.roles, name="Muted")
                    if not muted_role:
                        logger.warning(f"Muted role not found in {guild.name}")
                        continue
                    
                    # Get the member
                    member = guild.get_member(user_id)
                    if not member:
                        # Member left the server, remove from database
                        self.db.remove_temp_mute(user_id)
                        continue
                    
                    # Remove the muted role
                    await member.remove_roles(muted_role, reason="Temporary mute expired")
                    
                    # Remove from database
                    self.db.remove_temp_mute(user_id)
                    
                    # Log the action
                    embed = discord.Embed(
                        title=f"🔊 Unmute | {member.name}",
                        description=f"Temporary mute expired for {member.mention} (`{member.id}`)",
                        color=discord.Color.green(),
                        timestamp=datetime.datetime.now()
                    )
                    embed.add_field(name="📅 Expired", value=f"<t:{current_time}:F>", inline=True)
                    embed.set_footer(text=f"User ID: {member.id} | ShadowIDE Moderation", icon_url="https://shadowide.f1shy312.com/static/logo.png")
                    await log_to_channel(self.bot, embed)
                    
                    # Try to DM the user
                    await self.send_dm(
                        member, 
                        "unmuted", 
                        guild.name, 
                        "Temporary mute expired", 
                        None
                    )
                    
                    logger.info(f"Unmuted {member.name} ({member.id}) in {guild.name} due to expired mute")
                except (discord.Forbidden, discord.HTTPException) as e:
                    logger.error(f"Error unmuting user {user_id} in {guild.name}: {e}")
    
    @check_expired_punishments.before_loop
    async def before_check_expired_punishments(self):
        """Wait until the bot is ready before starting the task."""
        await self.bot.wait_until_ready()
    
    @app_commands.command(name="ban", description="Ban a user from the server")
    @app_commands.describe(
        user="The user to ban",
        reason="The reason for the ban",
        duration="Duration in format 1m, 1h, 1d, 1w, 1mo (optional)"
    )
    @app_commands.default_permissions(ban_members=True)
    async def ban(self, interaction: discord.Interaction, user: discord.Member, 
                 reason: Optional[str] = None, duration: Optional[str] = None):
        """Ban a user from the server."""
        # Check if the bot can ban the user
        if not interaction.guild.me.guild_permissions.ban_members:
            await interaction.response.send_message("I don't have permission to ban members.", ephemeral=True)
            return
        
        # Check if the user is trying to ban themselves
        if user.id == interaction.user.id:
            await interaction.response.send_message("You can't ban yourself.", ephemeral=True)
            return
        
        # Check if the user is trying to ban the bot
        if user.id == self.bot.user.id:
            await interaction.response.send_message("I can't ban myself.", ephemeral=True)
            return
        
        # Check if the user is higher in the role hierarchy
        if interaction.guild.me.top_role <= user.top_role:
            await interaction.response.send_message(
                "I can't ban this user because they have a higher or equal role to me.",
                ephemeral=True
            )
            return
        
        # Check if the moderator is higher in the role hierarchy
        if interaction.user.top_role <= user.top_role and interaction.user.id != interaction.guild.owner_id:
            await interaction.response.send_message(
                "You can't ban this user because they have a higher or equal role to you.",
                ephemeral=True
            )
            return
        
        # Parse duration if provided
        time_delta = None
        human_readable_duration = "Permanent"
        
        if duration:
            time_delta, human_readable_duration = parse_time_string(duration)
            if not time_delta:
                await interaction.response.send_message(
                    f"Invalid duration format: {duration}. Use formats like 1m, 1h, 1d, 1w, 1mo.",
                    ephemeral=True
                )
                return
        
        # Try to DM the user before banning
        dm_success = await self.send_dm(
            user, "banned", interaction.guild.name, reason, duration
        )
        
        # Ban the user
        try:
            await interaction.guild.ban(user, reason=reason or "No reason provided")
            
            # Create log embed
            action = "Temporary Ban" if duration else "Ban"
            embed = await self.create_log_embed(
                action, user, interaction.user, reason, human_readable_duration
            )
            
            # Add to database if temporary
            if time_delta:
                end_time = get_future_timestamp(time_delta)
                self.db.add_temp_ban(user.id, interaction.guild.id, end_time)
                
                formatted_time = get_formatted_timestamp(end_time, "F")  # Full date and time
                relative_time = get_formatted_timestamp(end_time, "R")   # Relative time
                embed.add_field(
                    name="⌛ Expires",
                    value=f"{formatted_time}\n{relative_time}",
                    inline=False
                )
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Respond to the interaction
            response = f"**Banned {user.name}**"
            if reason:
                response += f"\n📝 Reason: {reason}"
            if duration:
                if time_delta:
                    end_timestamp = get_future_timestamp(time_delta)
                    response += f"\n⏱️ Duration: {human_readable_duration}"
                    response += f"\n⌛ Expires: {get_formatted_timestamp(end_timestamp, 'F')} ({get_formatted_timestamp(end_timestamp, 'R')})"
                else:
                    response += f"\n⏱️ Duration: {human_readable_duration}"
            if not dm_success:
                response += "\n(User could not be notified via DM)"
            
            await interaction.response.send_message(response)
            logger.info(f"{interaction.user.name} banned {user.name} ({user.id}) in {interaction.guild.name}")
        except discord.Forbidden:
            await interaction.response.send_message("I don't have permission to ban that user.", ephemeral=True)
        except discord.HTTPException as e:
            await interaction.response.send_message(f"An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="unban", description="Unban a user from the server")
    @app_commands.describe(user_id="The ID of the user to unban")
    @app_commands.default_permissions(ban_members=True)
    async def unban(self, interaction: discord.Interaction, user_id: str):
        """Unban a user from the server by their ID."""
        # Check if the bot can ban members (to unban)
        if not interaction.guild.me.guild_permissions.ban_members:
            await interaction.response.send_message("I don't have permission to unban members.", ephemeral=True)
            return
        
        # Validate that the user ID is a number
        try:
            user_id = int(user_id)
        except ValueError:
            await interaction.response.send_message("User ID must be a number.", ephemeral=True)
            return
        
        try:
            # Defer response since fetching bans can take time
            await interaction.response.defer(ephemeral=False, thinking=True)
            
            # Fetch the ban entry
            ban_entry = None
            bans = [entry async for entry in interaction.guild.bans()]
            for entry in bans:
                if entry.user.id == user_id:
                    ban_entry = entry
                    break
            
            if not ban_entry:
                await interaction.followup.send(f"User with ID {user_id} is not banned.")
                return
            
            # Unban the user
            user = ban_entry.user
            await interaction.guild.unban(user, reason=f"Unbanned by {interaction.user.name}")
            
            # Remove from temporary bans in database if present
            self.db.remove_temp_ban(user_id)
            
            # Create log embed
            embed = await self.create_log_embed("Unban", user, interaction.user)
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Try to DM the user
            dm_success = await self.send_dm(user, "unbanned", interaction.guild.name)
            
            # Respond to the interaction
            response = f"**Unbanned {user.name}**"
            if not dm_success:
                response += "\n(User could not be notified via DM)"
            
            await interaction.followup.send(response)
            logger.info(f"{interaction.user.name} unbanned {user.name} ({user.id}) in {interaction.guild.name}")
        except discord.Forbidden:
            await interaction.followup.send("I don't have permission to unban that user.")
        except discord.HTTPException as e:
            await interaction.followup.send(f"An error occurred: {e}")
    
    @app_commands.command(name="kick", description="Kick a user from the server")
    @app_commands.describe(
        user="The user to kick",
        reason="The reason for the kick"
    )
    @app_commands.default_permissions(kick_members=True)
    async def kick(self, interaction: discord.Interaction, user: discord.Member, reason: Optional[str] = None):
        """Kick a user from the server."""
        # Check if the bot can kick the user
        if not interaction.guild.me.guild_permissions.kick_members:
            await interaction.response.send_message("I don't have permission to kick members.", ephemeral=True)
            return
        
        # Check if the user is trying to kick themselves
        if user.id == interaction.user.id:
            await interaction.response.send_message("You can't kick yourself.", ephemeral=True)
            return
        
        # Check if the user is trying to kick the bot
        if user.id == self.bot.user.id:
            await interaction.response.send_message("I can't kick myself.", ephemeral=True)
            return
        
        # Check if the user is higher in the role hierarchy
        if interaction.guild.me.top_role <= user.top_role:
            await interaction.response.send_message(
                "I can't kick this user because they have a higher or equal role to me.",
                ephemeral=True
            )
            return
        
        # Check if the moderator is higher in the role hierarchy
        if interaction.user.top_role <= user.top_role and interaction.user.id != interaction.guild.owner_id:
            await interaction.response.send_message(
                "You can't kick this user because they have a higher or equal role to you.",
                ephemeral=True
            )
            return
        
        # Try to DM the user before kicking
        dm_success = await self.send_dm(user, "kicked", interaction.guild.name, reason)
        
        # Kick the user
        try:
            await user.kick(reason=reason or "No reason provided")
            
            # Create log embed
            embed = await self.create_log_embed("Kick", user, interaction.user, reason)
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Respond to the interaction
            response = f"**Kicked {user.name}**"
            if reason:
                response += f"\nReason: {reason}"
            if not dm_success:
                response += "\n(User could not be notified via DM)"
            
            await interaction.response.send_message(response)
            logger.info(f"{interaction.user.name} kicked {user.name} ({user.id}) from {interaction.guild.name}")
        except discord.Forbidden:
            await interaction.response.send_message("I don't have permission to kick that user.", ephemeral=True)
        except discord.HTTPException as e:
            await interaction.response.send_message(f"An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="mute", description="Mute a user in the server")
    @app_commands.describe(
        user="The user to mute",
        duration="Duration in format 1m, 1h, 1d, 1w, 1mo",
        reason="The reason for the mute"
    )
    @app_commands.default_permissions(manage_roles=True)
    async def mute(self, interaction: discord.Interaction, user: discord.Member, 
                  duration: str, reason: Optional[str] = None):
        """Mute a user in the server."""
        # Check if the bot can manage roles
        if not interaction.guild.me.guild_permissions.manage_roles:
            await interaction.response.send_message("I don't have permission to manage roles.", ephemeral=True)
            return
        
        # Check if the user is trying to mute themselves
        if user.id == interaction.user.id:
            await interaction.response.send_message("You can't mute yourself.", ephemeral=True)
            return
        
        # Check if the user is trying to mute the bot
        if user.id == self.bot.user.id:
            await interaction.response.send_message("I can't mute myself.", ephemeral=True)
            return
        
        # Check if the user is higher in the role hierarchy
        if interaction.guild.me.top_role <= user.top_role:
            await interaction.response.send_message(
                "I can't mute this user because they have a higher or equal role to me.",
                ephemeral=True
            )
            return
        
        # Check if the moderator is higher in the role hierarchy
        if interaction.user.top_role <= user.top_role and interaction.user.id != interaction.guild.owner_id:
            await interaction.response.send_message(
                "You can't mute this user because they have a higher or equal role to you.",
                ephemeral=True
            )
            return
        
        # Parse duration
        time_delta, human_readable_duration = parse_time_string(duration)
        if not time_delta:
            await interaction.response.send_message(
                f"Invalid duration format: {duration}. Use formats like 1m, 1h, 1d, 1w, 1mo.",
                ephemeral=True
            )
            return
        
        # Defer response since role operations can take time
        await interaction.response.defer(ephemeral=False, thinking=True)
        
        # Ensure muted role exists
        muted_role = await self.ensure_mute_role(interaction.guild)
        if not muted_role:
            await interaction.followup.send("Failed to create or find the Muted role.")
            return
        
        # Check if the user is already muted
        if muted_role in user.roles:
            await interaction.followup.send(f"{user.mention} is already muted.")
            return
        
        # Try to DM the user before muting
        dm_success = await self.send_dm(
            user, "muted", interaction.guild.name, reason, duration
        )
        
        # Mute the user
        try:
            await user.add_roles(muted_role, reason=reason or "No reason provided")
            
            # Add to database
            end_time = get_future_timestamp(time_delta)
            self.db.add_temp_mute(user.id, interaction.guild.id, end_time)
            
            # Create log embed
            embed = await self.create_log_embed("Mute", user, interaction.user, reason, human_readable_duration)
            
            formatted_time = get_formatted_timestamp(end_time, "F")  # Full date and time
            relative_time = get_formatted_timestamp(end_time, "R")   # Relative time
            embed.add_field(
                name="⌛ Expires",
                value=f"{formatted_time}\n{relative_time}",
                inline=False
            )
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Respond to the interaction
            response = f"**Muted {user.name}**"
            if reason:
                response += f"\n📝 Reason: {reason}"
            
            formatted_time = get_formatted_timestamp(end_time, "F")  # Full date and time
            relative_time = get_formatted_timestamp(end_time, "R")   # Relative time
            response += f"\n⏱️ Duration: {human_readable_duration}"
            response += f"\n⌛ Expires: {formatted_time} ({relative_time})"
            
            if not dm_success:
                response += "\n(User could not be notified via DM)"
            
            await interaction.followup.send(response)
            logger.info(f"{interaction.user.name} muted {user.name} ({user.id}) in {interaction.guild.name}")
        except discord.Forbidden:
            await interaction.followup.send("I don't have permission to mute that user.")
        except discord.HTTPException as e:
            await interaction.followup.send(f"An error occurred: {e}")
    
    @app_commands.command(name="unmute", description="Unmute a user in the server")
    @app_commands.describe(user="The user to unmute")
    @app_commands.default_permissions(manage_roles=True)
    async def unmute(self, interaction: discord.Interaction, user: discord.Member):
        """Unmute a user in the server."""
        # Check if the bot can manage roles
        if not interaction.guild.me.guild_permissions.manage_roles:
            await interaction.response.send_message("I don't have permission to manage roles.", ephemeral=True)
            return
        
        # Find the muted role
        muted_role = discord.utils.get(interaction.guild.roles, name="Muted")
        if not muted_role:
            await interaction.response.send_message("Muted role not found.", ephemeral=True)
            return
        
        # Check if the user is not muted
        if muted_role not in user.roles:
            await interaction.response.send_message(f"{user.mention} is not muted.", ephemeral=True)
            return
        
        # Unmute the user
        try:
            await user.remove_roles(muted_role, reason=f"Unmuted by {interaction.user.name}")
            
            # Remove from database
            self.db.remove_temp_mute(user.id)
            
            # Create log embed
            embed = await self.create_log_embed("Unmute", user, interaction.user)
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Try to DM the user
            dm_success = await self.send_dm(user, "unmuted", interaction.guild.name)
            
            # Respond to the interaction
            response = f"**Unmuted {user.name}**"
            if not dm_success:
                response += "\n(User could not be notified via DM)"
            
            await interaction.response.send_message(response)
            logger.info(f"{interaction.user.name} unmuted {user.name} ({user.id}) in {interaction.guild.name}")
        except discord.Forbidden:
            await interaction.response.send_message("I don't have permission to unmute that user.", ephemeral=True)
        except discord.HTTPException as e:
            await interaction.response.send_message(f"An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="warn", description="Warn a user in the server")
    @app_commands.describe(
        user="The user to warn",
        reason="The reason for the warning"
    )
    @app_commands.default_permissions(kick_members=True)
    async def warn(self, interaction: discord.Interaction, user: discord.Member, reason: str):
        """Warn a user in the server."""
        # Check if the user is trying to warn themselves
        if user.id == interaction.user.id:
            await interaction.response.send_message("You can't warn yourself.", ephemeral=True)
            return
        
        # Check if the user is trying to warn the bot
        if user.id == self.bot.user.id:
            await interaction.response.send_message("I can't warn myself.", ephemeral=True)
            return
        
        # Check if the moderator is higher in the role hierarchy
        if interaction.user.top_role <= user.top_role and interaction.user.id != interaction.guild.owner_id:
            await interaction.response.send_message(
                "You can't warn this user because they have a higher or equal role to you.",
                ephemeral=True
            )
            return
        
        # Add warning to database
        warning_id = self.db.add_warning(user.id, interaction.user.id, reason)
        if not warning_id:
            await interaction.response.send_message("Failed to add warning to database.", ephemeral=True)
            return
        
        # Try to DM the user
        dm_success = await self.send_dm(user, "warned", interaction.guild.name, reason)
        
        # Create log embed
        embed = await self.create_log_embed("Warning", user, interaction.user, reason)
        embed.add_field(name="Warning ID", value=str(warning_id), inline=False)
        
        # Log to the log channel
        await log_to_channel(self.bot, embed)
        
        # Respond to the interaction
        response = f"**Warned {user.name}**\nReason: {reason}\nWarning ID: {warning_id}"
        if not dm_success:
            response += "\n(User could not be notified via DM)"
        
        await interaction.response.send_message(response)
        logger.info(f"{interaction.user.name} warned {user.name} ({user.id}) in {interaction.guild.name}")
    
    @app_commands.command(name="warnings", description="View warnings for a user")
    @app_commands.describe(user="The user to view warnings for")
    @app_commands.default_permissions(kick_members=True)
    async def warnings(self, interaction: discord.Interaction, user: discord.Member):
        """View warnings for a user."""
        # Get warnings from database
        warnings = self.db.get_warnings(user.id)
        
        if not warnings:
            await interaction.response.send_message(f"✅ {user.name} has no warnings.", ephemeral=True)
            return
        
        # Create embed
        embed = discord.Embed(
            title=f"⚠️ Warnings for {user.name}",
            color=discord.Color.orange(),
            description=f"User has **{len(warnings)}** warning{'s' if len(warnings) != 1 else ''}",
            timestamp=datetime.datetime.now()
        )
        embed.set_thumbnail(url=user.display_avatar.url)
        
        # Add warnings to embed with better formatting
        for i, (warning_id, moderator_id, reason, timestamp) in enumerate(warnings):
            moderator = interaction.guild.get_member(moderator_id)
            moderator_name = moderator.name if moderator else f"Unknown Moderator ({moderator_id})"
            
            # Format the time in a more readable way
            formatted_date = f"<t:{timestamp}:F>"
            
            warning_value = (
                f"**Reason:** {reason}\n"
                f"**By:** {moderator_name}\n"
                f"**When:** {formatted_date}\n"
                f"**ID:** `{warning_id}`"
            )
            
            embed.add_field(
                name=f"Warning #{i+1}",
                value=warning_value,
                inline=False
            )
        
        embed.set_footer(text=f"User ID: {user.id} | ShadowIDE Moderation", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @app_commands.command(name="clear", description="Clear messages in the current channel")
    @app_commands.describe(amount="The number of messages to clear (1-100) or 'all' to clear all messages")
    @app_commands.default_permissions(manage_messages=True)
    async def clear(self, interaction: discord.Interaction, amount: str):
        """Clear messages in the current channel."""
        # Check if the bot can manage messages
        if not interaction.guild.me.guild_permissions.manage_messages:
            await interaction.response.send_message("❌ I don't have permission to manage messages.", ephemeral=True)
            return
        
        # Defer response since this might take a while
        await interaction.response.defer(ephemeral=True, thinking=True)
        
        # Handle "all" parameter
        if amount.lower() == "all":
            total_deleted = 0
            while True:
                try:
                    # Delete messages in batches of 100
                    deleted = await interaction.channel.purge(limit=100)
                    if not deleted:
                        break
                    total_deleted += len(deleted)
                    # Small delay to avoid rate limits
                    await asyncio.sleep(1)
                except discord.Forbidden:
                    await interaction.followup.send("❌ I don't have permission to delete messages.")
                    return
                except discord.HTTPException as e:
                    await interaction.followup.send(f"❌ An error occurred: {e}")
                    return
            
            # Create log embed
            embed = discord.Embed(
                title=f"🧹 Messages Cleared",
                description=f"{interaction.user.mention} cleared **all** messages in {interaction.channel.mention}",
                color=discord.Color.blue(),
                timestamp=datetime.datetime.now()
            )
            embed.add_field(name="Channel", value=f"{interaction.channel.name} (`{interaction.channel.id}`)", inline=True)
            embed.add_field(name="Amount", value=f"{total_deleted} messages", inline=True)
            embed.set_footer(text=f"Moderator: {interaction.user.name} | ShadowIDE Moderation", icon_url=interaction.user.display_avatar.url)
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Respond to the interaction
            await interaction.followup.send(f"✅ **Cleared all messages ({total_deleted} total)**", ephemeral=True)
            logger.info(f"{interaction.user.name} cleared all messages in {interaction.channel.name}")
            return
        
        # Handle numeric amount
        try:
            amount = int(amount)
        except ValueError:
            await interaction.followup.send("❌ Amount must be a number between 1 and 100, or 'all'.", ephemeral=True)
            return
        
        # Validate amount
        if amount < 1 or amount > 100:
            await interaction.followup.send("❌ Amount must be between 1 and 100, or 'all'.", ephemeral=True)
            return
        
        # Delete messages
        try:
            # Delete messages
            deleted = await interaction.channel.purge(limit=amount)
            
            # Create log embed
            embed = discord.Embed(
                title=f"🧹 Messages Cleared",
                description=f"{interaction.user.mention} cleared **{len(deleted)}** messages in {interaction.channel.mention}",
                color=discord.Color.blue(),
                timestamp=datetime.datetime.now()
            )
            embed.add_field(name="Channel", value=f"{interaction.channel.name} (`{interaction.channel.id}`)", inline=True)
            embed.add_field(name="Amount", value=f"{len(deleted)} message{'s' if len(deleted) != 1 else ''}", inline=True)
            embed.set_footer(text=f"Moderator: {interaction.user.name} | ShadowIDE Moderation", icon_url=interaction.user.display_avatar.url)
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Respond to the interaction
            await interaction.followup.send(f"✅ **Cleared {len(deleted)} message{'s' if len(deleted) != 1 else ''}**", ephemeral=True)
            logger.info(f"{interaction.user.name} cleared {len(deleted)} messages in {interaction.channel.name}")
        except discord.Forbidden:
            await interaction.followup.send("❌ I don't have permission to delete messages.")
        except discord.HTTPException as e:
            await interaction.followup.send(f"❌ An error occurred: {e}")
    
    @app_commands.command(name="lock", description="Lock the current channel")
    @app_commands.default_permissions(manage_channels=True)
    async def lock(self, interaction: discord.Interaction):
        """Lock the current channel for everyone."""
        # Check if the bot can manage channels
        if not interaction.guild.me.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ I don't have permission to manage channels.", ephemeral=True)
            return
        
        # Get the @everyone role
        everyone_role = interaction.guild.default_role
        
        # Check current permissions
        current_perms = interaction.channel.overwrites_for(everyone_role)
        if current_perms.send_messages is False:
            await interaction.response.send_message("❌ This channel is already locked.", ephemeral=True)
            return
        
        # Update permissions
        try:
            current_perms.send_messages = False
            await interaction.channel.set_permissions(
                everyone_role,
                overwrite=current_perms,
                reason=f"Channel locked by {interaction.user.name}"
            )
            
            # Create log embed
            embed = discord.Embed(
                title=f"🔒 Channel Locked",
                description=f"{interaction.user.mention} locked {interaction.channel.mention}",
                color=discord.Color.red(),
                timestamp=datetime.datetime.now()
            )
            embed.add_field(name="Channel", value=f"{interaction.channel.name} (`{interaction.channel.id}`)", inline=True)
            embed.add_field(name="Moderator", value=f"{interaction.user.name} (`{interaction.user.id}`)", inline=True)
            embed.set_footer(text="ShadowIDE Moderation System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Create a visible message in the channel
            channel_embed = discord.Embed(
                title="🔒 Channel Locked",
                description="This channel has been locked by a moderator. Only staff can send messages.",
                color=discord.Color.red(),
                timestamp=datetime.datetime.now()
            )
            channel_embed.set_footer(text=f"Locked by: {interaction.user.name}", icon_url=interaction.user.display_avatar.url)
            
            # Respond to the interaction and send channel message
            await interaction.response.send_message("🔒 Channel locked successfully.", ephemeral=True)
            await interaction.channel.send(embed=channel_embed)
            
            logger.info(f"{interaction.user.name} locked channel {interaction.channel.name}")
        except discord.Forbidden:
            await interaction.response.send_message("❌ I don't have permission to lock this channel.", ephemeral=True)
        except discord.HTTPException as e:
            await interaction.response.send_message(f"❌ An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="unlock", description="Unlock the current channel")
    @app_commands.default_permissions(manage_channels=True)
    async def unlock(self, interaction: discord.Interaction):
        """Unlock the current channel for everyone."""
        # Check if the bot can manage channels
        if not interaction.guild.me.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ I don't have permission to manage channels.", ephemeral=True)
            return
        
        # Get the @everyone role
        everyone_role = interaction.guild.default_role
        
        # Check current permissions
        current_perms = interaction.channel.overwrites_for(everyone_role)
        if current_perms.send_messages is not False:
            await interaction.response.send_message("❌ This channel is not locked.", ephemeral=True)
            return
        
        # Update permissions
        try:
            current_perms.send_messages = None
            await interaction.channel.set_permissions(
                everyone_role,
                overwrite=current_perms,
                reason=f"Channel unlocked by {interaction.user.name}"
            )
            
            # Create log embed
            embed = discord.Embed(
                title=f"🔓 Channel Unlocked",
                description=f"{interaction.user.mention} unlocked {interaction.channel.mention}",
                color=discord.Color.green(),
                timestamp=datetime.datetime.now()
            )
            embed.add_field(name="Channel", value=f"{interaction.channel.name} (`{interaction.channel.id}`)", inline=True)
            embed.add_field(name="Moderator", value=f"{interaction.user.name} (`{interaction.user.id}`)", inline=True)
            embed.set_footer(text="ShadowIDE Moderation System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
            
            # Log to the log channel
            await log_to_channel(self.bot, embed)
            
            # Create a visible message in the channel
            channel_embed = discord.Embed(
                title="🔓 Channel Unlocked",
                description="This channel has been unlocked. Everyone can now send messages again.",
                color=discord.Color.green(),
                timestamp=datetime.datetime.now()
            )
            channel_embed.set_footer(text=f"Unlocked by: {interaction.user.name}", icon_url=interaction.user.display_avatar.url)
            
            # Respond to the interaction and send channel message
            await interaction.response.send_message("🔓 Channel unlocked successfully.", ephemeral=True)
            await interaction.channel.send(embed=channel_embed)
            
            logger.info(f"{interaction.user.name} unlocked channel {interaction.channel.name}")
        except discord.Forbidden:
            await interaction.response.send_message("❌ I don't have permission to unlock this channel.", ephemeral=True)
        except discord.HTTPException as e:
            await interaction.response.send_message(f"❌ An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="say", description="Make the bot say something")
    @app_commands.describe(
        message="The message to send",
        color="Optional: Color for the embed (red, green, blue, gold, orange, purple)",
        title="Optional: Title for the embed"
    )
    @app_commands.default_permissions(administrator=True)
    async def say(self, interaction: discord.Interaction, 
                  message: str, 
                  color: Optional[str] = None,
                  title: Optional[str] = None):
        """Make the bot say something as an embed with customization options."""
        # Define color map
        color_map = {
            "red": discord.Color.red(),
            "green": discord.Color.green(),
            "blue": discord.Color.blue(),
            "gold": discord.Color.gold(),
            "orange": discord.Color.orange(),
            "purple": discord.Color.purple(),
            "default": discord.Color.blue()
        }
        
        # Get the specified color or use default
        embed_color = color_map.get(color.lower() if color else None, color_map["default"])
        
        # Create the embed
        embed = discord.Embed(
            description=message,
            color=embed_color,
            timestamp=datetime.datetime.now()
        )
        
        # Add title if provided
        if title:
            embed.title = title
        
        # Set footer with ShadowIDE branding
        embed.set_footer(text="ShadowIDE Discord", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        # Create log embed
        log_embed = discord.Embed(
            title=f"💬 Bot Message Sent",
            description=f"{interaction.user.mention} made the bot say something in {interaction.channel.mention}",
            color=discord.Color.blue(),
            timestamp=datetime.datetime.now()
        )
        log_embed.add_field(name="Content", value=message if len(message) <= 1024 else f"{message[:1021]}...", inline=False)
        
        if title:
            log_embed.add_field(name="Title", value=title, inline=True)
        
        log_embed.add_field(name="Color", value=color or "default", inline=True)
        log_embed.add_field(name="Channel", value=f"{interaction.channel.name} (`{interaction.channel.id}`)", inline=True)
        log_embed.set_footer(text=f"Sent by: {interaction.user.name} | ShadowIDE Moderation", icon_url=interaction.user.display_avatar.url)
        
        # Log to the log channel
        await log_to_channel(self.bot, log_embed)
        
        # Respond to the interaction
        await interaction.response.send_message("✅ Message sent.", ephemeral=True)
        await interaction.channel.send(embed=embed)
        logger.info(f"{interaction.user.name} made the bot send a message in {interaction.channel.name}")

    @app_commands.command(name="modprofile", description="View detailed information about a user")
    @app_commands.describe(user="The user to view information about")
    @app_commands.default_permissions(kick_members=True)
    async def modprofile(self, interaction: discord.Interaction, user: discord.Member = None):
        """View detailed profile information about a user."""
        # If no user specified, show the command user's profile
        if not user:
            user = interaction.user
        
        # Get timestamps in Discord format
        joined_at = int(user.joined_at.timestamp()) if user.joined_at else None
        created_at = int(user.created_at.timestamp())
        
        # Calculate account age
        now = datetime.datetime.now(datetime.timezone.utc)
        account_age = now - user.created_at
        server_age = now - user.joined_at if user.joined_at else None
        
        # Get warnings from database
        warnings = self.db.get_warnings(user.id)
        warning_count = len(warnings)
        
        # Check if the user is muted
        muted_role = discord.utils.get(interaction.guild.roles, name="Muted")
        is_muted = muted_role in user.roles if muted_role else False
        
        # Create embed
        embed = discord.Embed(
            title=f"👤 User Profile: {user.name}",
            color=user.color,
            timestamp=datetime.datetime.now()
        )
        
        # Set thumbnail to user avatar
        embed.set_thumbnail(url=user.display_avatar.url)
        
        # Basic user information
        embed.add_field(
            name="📋 User Info",
            value=(
                f"**Name:** {user.name}\n"
                f"**ID:** `{user.id}`\n"
                f"**Nickname:** {user.nick or 'None'}\n"
            ),
            inline=True
        )
        
        # Dates information
        embed.add_field(
            name="📅 Dates",
            value=(
                f"**Joined Server:** <t:{joined_at}:R> (<t:{joined_at}:D>)\n" if joined_at else "**Joined Server:** Unknown\n"
                f"**Joined Discord:** <t:{created_at}:R> (<t:{created_at}:D>)\n"
                f"**Account Age:** {account_age.days} days\n"
                f"**Server Age:** {server_age.days if server_age else 'Unknown'} days"
            ),
            inline=True
        )
        
        # Role information
        roles = [role.mention for role in user.roles if role.name != "@everyone"]
        roles.reverse()  # Show highest roles first
        
        embed.add_field(
            name=f"🏷️ Roles ({len(roles)})",
            value=" ".join(roles) if roles else "None",
            inline=False
        )
        
        # Moderation information
        mod_info = []
        
        if warning_count > 0:
            mod_info.append(f"**Warnings:** {warning_count}")
        
        if is_muted:
            # Check if there's a temporary mute
            mute_status = "Muted"
            current_time = int(now.timestamp())
            temp_mutes = self.db.get_expired_mutes(current_time + 9999999)  # Get all future expirations
            
            for mute_user_id, _ in temp_mutes:
                if mute_user_id == user.id:
                    # Find expiry time and format it
                    cursor = self.db.conn.cursor()
                    cursor.execute("SELECT end_time FROM temp_mutes WHERE user_id = ?", (user.id,))
                    result = cursor.fetchone()
                    if result:
                        end_time = result[0]
                        mute_status = f"Muted until {get_formatted_timestamp(end_time, 'F')} ({get_formatted_timestamp(end_time, 'R')})"
                    break
            
            mod_info.append(mute_status)
        
        # Check if user is banned
        try:
            ban_entry = await interaction.guild.fetch_ban(discord.Object(id=user.id))
            if ban_entry:
                mod_info.append(f"**Banned:** Yes (Reason: {ban_entry.reason or 'No reason provided'})")
        except (discord.NotFound, discord.Forbidden):
            # User is not banned or bot can't check bans
            pass
        
        if mod_info:
            embed.add_field(
                name="🛡️ Moderation",
                value="\n".join(mod_info),
                inline=False
            )
        
        # Permissions
        key_permissions = []
        permissions = user.guild_permissions
        
        if permissions.administrator:
            key_permissions.append("Administrator")
        else:
            if permissions.manage_guild:
                key_permissions.append("Manage Server")
            if permissions.ban_members:
                key_permissions.append("Ban Members")
            if permissions.kick_members:
                key_permissions.append("Kick Members")
            if permissions.manage_channels:
                key_permissions.append("Manage Channels")
            if permissions.manage_messages:
                key_permissions.append("Manage Messages")
            if permissions.manage_roles:
                key_permissions.append("Manage Roles")
            if permissions.mention_everyone:
                key_permissions.append("Mention Everyone")
        
        if key_permissions:
            embed.add_field(
                name="🔑 Key Permissions",
                value=", ".join(key_permissions),
                inline=False
            )
        
        # Set footer with timestamp
        embed.set_footer(text=f"Requested by {interaction.user.name} | ShadowIDE Moderation", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        # Create view with buttons
        view = discord.ui.View(timeout=60)  # 60 second timeout
        
        # Only add warnings button if the user has warnings
        if warning_count > 0:
            # Create warnings button
            warnings_button = discord.ui.Button(
                style=discord.ButtonStyle.primary,
                label=f"View Warnings ({warning_count})",
                emoji="⚠️",
                custom_id=f"view_warnings_{user.id}"
            )
            
            async def warnings_button_callback(button_interaction):
                # Check if the original interaction user is the one clicking
                if button_interaction.user.id != interaction.user.id:
                    await button_interaction.response.send_message("You cannot use this button.", ephemeral=True)
                    return
                
                # Get warnings from database
                warnings = self.db.get_warnings(user.id)
                
                # Create embed
                warnings_embed = discord.Embed(
                    title=f"⚠️ Warnings for {user.name}",
                    color=discord.Color.orange(),
                    description=f"User has **{len(warnings)}** warning{'s' if len(warnings) != 1 else ''}",
                    timestamp=datetime.datetime.now()
                )
                warnings_embed.set_thumbnail(url=user.display_avatar.url)
                
                # Add warnings to embed with better formatting
                for i, (warning_id, moderator_id, reason, timestamp) in enumerate(warnings):
                    moderator = interaction.guild.get_member(moderator_id)
                    moderator_name = moderator.name if moderator else f"Unknown Moderator ({moderator_id})"
                    
                    # Format the time in a more readable way
                    formatted_date = f"<t:{timestamp}:F>"
                    
                    warning_value = (
                        f"**Reason:** {reason}\n"
                        f"**By:** {moderator_name}\n"
                        f"**When:** {formatted_date}\n"
                        f"**ID:** `{warning_id}`"
                    )
                    
                    warnings_embed.add_field(
                        name=f"Warning #{i+1}",
                        value=warning_value,
                        inline=False
                    )
                
                warnings_embed.set_footer(text=f"User ID: {user.id} | ShadowIDE Moderation", icon_url="https://shadowide.f1shy312.com/static/logo.png")
                
                await button_interaction.response.send_message(embed=warnings_embed, ephemeral=True)
            
            warnings_button.callback = warnings_button_callback
            view.add_item(warnings_button)
        
        # Add moderator action buttons if user has appropriate permissions
        if interaction.user.guild_permissions.kick_members:
            # Warn button
            warn_button = discord.ui.Button(
                style=discord.ButtonStyle.danger,
                label="Warn User",
                emoji="⚠️",
                custom_id=f"warn_{user.id}"
            )
            
            async def warn_button_callback(button_interaction):
                # Check if the original interaction user is the one clicking
                if button_interaction.user.id != interaction.user.id:
                    await button_interaction.response.send_message("You cannot use this button.", ephemeral=True)
                    return
                
                # Create a modal for the warning reason
                class WarnModal(discord.ui.Modal, title="Warn User"):
                    reason = discord.ui.TextInput(
                        label="Reason",
                        placeholder="Enter reason for warning...",
                        min_length=1,
                        max_length=1000,
                        required=True,
                        style=discord.TextStyle.paragraph
                    )
                    
                    async def on_submit(self, modal_interaction):
                        reason_text = self.reason.value
                        
                        # Add warning to database
                        warning_id = self.view.cog.db.add_warning(user.id, modal_interaction.user.id, reason_text)
                        if not warning_id:
                            await modal_interaction.response.send_message("Failed to add warning to database.", ephemeral=True)
                            return
                        
                        # Try to DM the user
                        dm_success = await self.view.cog.send_dm(user, "warned", modal_interaction.guild.name, reason_text)
                        
                        # Create log embed
                        embed = await self.view.cog.create_log_embed("Warning", user, modal_interaction.user, reason_text)
                        embed.add_field(name="Warning ID", value=str(warning_id), inline=False)
                        
                        # Log to the log channel
                        await log_to_channel(self.view.cog.bot, embed)
                        
                        # Respond to the interaction
                        response = f"**Warned {user.name}**\nReason: {reason_text}\nWarning ID: {warning_id}"
                        if not dm_success:
                            response += "\n(User could not be notified via DM)"
                        
                        await modal_interaction.response.send_message(response, ephemeral=True)
                        logger.info(f"{modal_interaction.user.name} warned {user.name} ({user.id}) in {modal_interaction.guild.name}")
                
                modal = WarnModal()
                modal.view = view
                modal.view.cog = self
                await button_interaction.response.send_modal(modal)
            
            warn_button.callback = warn_button_callback
            view.add_item(warn_button)
            
            # Only add kick button if user has kick permissions
            if interaction.user.guild_permissions.kick_members:
                # Kick button
                kick_button = discord.ui.Button(
                    style=discord.ButtonStyle.danger,
                    label="Kick User",
                    emoji="👢",
                    custom_id=f"kick_{user.id}"
                )
                
                async def kick_button_callback(button_interaction):
                    # Check if the original interaction user is the one clicking
                    if button_interaction.user.id != interaction.user.id:
                        await button_interaction.response.send_message("You cannot use this button.", ephemeral=True)
                        return
                    
                    # Check role hierarchy
                    if button_interaction.guild.me.top_role <= user.top_role:
                        await button_interaction.response.send_message(
                            "I can't kick this user because they have a higher or equal role to me.",
                            ephemeral=True
                        )
                        return
                    
                    # Check if the moderator is higher in the role hierarchy
                    if button_interaction.user.top_role <= user.top_role and button_interaction.user.id != button_interaction.guild.owner_id:
                        await button_interaction.response.send_message(
                            "You can't kick this user because they have a higher or equal role to you.",
                            ephemeral=True
                        )
                        return
                    
                    # Create a modal for the kick reason
                    class KickModal(discord.ui.Modal, title="Kick User"):
                        reason = discord.ui.TextInput(
                            label="Reason",
                            placeholder="Enter reason for kick...",
                            min_length=1,
                            max_length=1000,
                            required=True,
                            style=discord.TextStyle.paragraph
                        )
                        
                        async def on_submit(self, modal_interaction):
                            reason_text = self.reason.value
                            
                            # Try to DM the user before kicking
                            dm_success = await self.view.cog.send_dm(user, "kicked", modal_interaction.guild.name, reason_text)
                            
                            try:
                                # Kick the user
                                await user.kick(reason=reason_text or "No reason provided")
                                
                                # Create log embed
                                embed = await self.view.cog.create_log_embed("Kick", user, modal_interaction.user, reason_text)
                                
                                # Log to the log channel
                                await log_to_channel(self.view.cog.bot, embed)
                                
                                # Respond to the interaction
                                response = f"**Kicked {user.name}**\n📝 Reason: {reason_text}"
                                if not dm_success:
                                    response += "\n(User could not be notified via DM)"
                                
                                await modal_interaction.response.send_message(response, ephemeral=True)
                                logger.info(f"{modal_interaction.user.name} kicked {user.name} ({user.id}) from {modal_interaction.guild.name}")
                            except discord.Forbidden:
                                await modal_interaction.response.send_message("I don't have permission to kick that user.", ephemeral=True)
                            except discord.HTTPException as e:
                                await modal_interaction.response.send_message(f"An error occurred: {e}", ephemeral=True)
                    
                    modal = KickModal()
                    modal.view = view
                    modal.view.cog = self
                    await button_interaction.response.send_modal(modal)
                
                kick_button.callback = kick_button_callback
                view.add_item(kick_button)
            
            # Only add ban button if user has ban permissions
            if interaction.user.guild_permissions.ban_members:
                # Ban button
                ban_button = discord.ui.Button(
                    style=discord.ButtonStyle.danger,
                    label="Ban User",
                    emoji="🔨",
                    custom_id=f"ban_{user.id}"
                )
                
                async def ban_button_callback(button_interaction):
                    # Check if the original interaction user is the one clicking
                    if button_interaction.user.id != interaction.user.id:
                        await button_interaction.response.send_message("You cannot use this button.", ephemeral=True)
                        return
                    
                    # Check role hierarchy
                    if button_interaction.guild.me.top_role <= user.top_role:
                        await button_interaction.response.send_message(
                            "I can't ban this user because they have a higher or equal role to me.",
                            ephemeral=True
                        )
                        return
                    
                    # Check if the moderator is higher in the role hierarchy
                    if button_interaction.user.top_role <= user.top_role and button_interaction.user.id != button_interaction.guild.owner_id:
                        await button_interaction.response.send_message(
                            "You can't ban this user because they have a higher or equal role to you.",
                            ephemeral=True
                        )
                        return
                    
                    # Create a modal for the ban reason and duration
                    class BanModal(discord.ui.Modal, title="Ban User"):
                        reason = discord.ui.TextInput(
                            label="Reason",
                            placeholder="Enter reason for ban...",
                            min_length=1,
                            max_length=1000,
                            required=True,
                            style=discord.TextStyle.paragraph
                        )
                        
                        duration = discord.ui.TextInput(
                            label="Duration (optional)",
                            placeholder="Examples: 1d, 7d, 1w, 1mo (leave empty for permanent)",
                            required=False,
                            max_length=10
                        )
                        
                        async def on_submit(self, modal_interaction):
                            reason_text = self.reason.value
                            duration_text = self.duration.value.strip() if self.duration.value else None
                            
                            # Parse duration if provided
                            time_delta = None
                            human_readable_duration = "Permanent"
                            
                            if duration_text:
                                time_delta, human_readable_duration = parse_time_string(duration_text)
                                if not time_delta:
                                    await modal_interaction.response.send_message(
                                        f"Invalid duration format: {duration_text}. Use formats like 1m, 1h, 1d, 1w, 1mo.",
                                        ephemeral=True
                                    )
                                    return
                            
                            # Try to DM the user before banning
                            dm_success = await self.view.cog.send_dm(
                                user, "banned", modal_interaction.guild.name, reason_text, duration_text
                            )
                            
                            try:
                                # Ban the user
                                await modal_interaction.guild.ban(user, reason=reason_text or "No reason provided")
                                
                                # Create log embed
                                action = "Temporary Ban" if duration_text else "Ban"
                                embed = await self.view.cog.create_log_embed(
                                    action, user, modal_interaction.user, reason_text, human_readable_duration
                                )
                                
                                # Add to database if temporary
                                if time_delta:
                                    end_time = get_future_timestamp(time_delta)
                                    self.view.cog.db.add_temp_ban(user.id, modal_interaction.guild.id, end_time)
                                    
                                    formatted_time = get_formatted_timestamp(end_time, "F")  # Full date and time
                                    relative_time = get_formatted_timestamp(end_time, "R")   # Relative time
                                    embed.add_field(
                                        name="⌛ Expires",
                                        value=f"{formatted_time}\n{relative_time}",
                                        inline=False
                                    )
                                
                                # Log to the log channel
                                await log_to_channel(self.view.cog.bot, embed)
                                
                                # Respond to the interaction
                                response = f"**Banned {user.name}**\n📝 Reason: {reason_text}"
                                if duration_text:
                                    if time_delta:
                                        end_timestamp = get_future_timestamp(time_delta)
                                        response += f"\n⏱️ Duration: {human_readable_duration}"
                                        response += f"\n⌛ Expires: {get_formatted_timestamp(end_timestamp, 'F')} ({get_formatted_timestamp(end_timestamp, 'R')})"
                                if not dm_success:
                                    response += "\n(User could not be notified via DM)"
                                
                                await modal_interaction.response.send_message(response, ephemeral=True)
                                logger.info(f"{modal_interaction.user.name} banned {user.name} ({user.id}) in {modal_interaction.guild.name}")
                            except discord.Forbidden:
                                await modal_interaction.response.send_message("I don't have permission to ban that user.", ephemeral=True)
                            except discord.HTTPException as e:
                                await modal_interaction.response.send_message(f"An error occurred: {e}", ephemeral=True)
                    
                    modal = BanModal()
                    modal.view = view
                    modal.view.cog = self
                    await button_interaction.response.send_modal(modal)
                
                ban_button.callback = ban_button_callback
                view.add_item(ban_button)
        
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="info", description="Display information about the bot and server")
    async def info(self, interaction: discord.Interaction):
        """Display information about the bot and server."""
        # Get bot info
        bot_user = self.bot.user
        guild = interaction.guild
        
        # Calculate bot uptime
        uptime_delta = datetime.datetime.now(datetime.timezone.utc) - self.start_time
        days = uptime_delta.days
        hours, remainder = divmod(uptime_delta.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_str = f"{days}d {hours}h {minutes}m {seconds}s"
        
        # Get server info
        member_count = len(guild.members)
        bot_count = len([m for m in guild.members if m.bot])
        human_count = member_count - bot_count
        channel_count = len(guild.channels)
        text_channel_count = len(guild.text_channels)
        voice_channel_count = len(guild.voice_channels)
        role_count = len(guild.roles) - 1  # Subtract @everyone
        
        # Get server boost info
        boost_level = guild.premium_tier
        boost_count = guild.premium_subscription_count
        
        # Create embed
        embed = discord.Embed(
            title="📊 ShadowIDE Bot Information",
            color=discord.Color.blue(),
            timestamp=datetime.datetime.now()
        )
        
        # Bot info section
        embed.set_thumbnail(url=bot_user.display_avatar.url)
        embed.add_field(
            name="🤖 Bot Information",
            value=(
                f"**Name:** {bot_user.name}\n"
                f"**ID:** `{bot_user.id}`\n"
                f"**Created:** <t:{int(bot_user.created_at.timestamp())}:R>\n"
                f"**Uptime:** {uptime_str}\n"
                f"**Developer:** [F1sHy312](https://shadowide.f1shy312.com)\n"
                f"**Latency:** {round(self.bot.latency * 1000)}ms\n"
                f"**Commands:** {len(self.bot.tree.get_commands())}"
            ),
            inline=True
        )
        
        # Server info section
        embed.add_field(
            name="🏠 Server Information",
            value=(
                f"**Name:** {guild.name}\n"
                f"**ID:** `{guild.id}`\n"
                f"**Owner:** {guild.owner.mention if guild.owner else 'Unknown'}\n"
                f"**Created:** <t:{int(guild.created_at.timestamp())}:R>\n"
                f"**Boost Level:** {boost_level} ({boost_count} boosts)"
            ),
            inline=True
        )
        
        # Member counts
        embed.add_field(
            name="👥 Members",
            value=(
                f"**Total:** {member_count}\n"
                f"**Humans:** {human_count}\n"
                f"**Bots:** {bot_count}"
            ),
            inline=True
        )
        
        # Channel counts
        embed.add_field(
            name="📚 Channels & Roles",
            value=(
                f"**Total Channels:** {channel_count}\n"
                f"**Text Channels:** {text_channel_count}\n"
                f"**Voice Channels:** {voice_channel_count}\n"
                f"**Roles:** {role_count}"
            ),
            inline=True
        )
        
        # Links section
        embed.add_field(
            name="🔗 Links",
            value=(
                f"[ShadowIDE Website](https://shadowide.f1shy312.com)\n"
                f"[GitHub](https://github.com/f1shyondrugs/ShadowIDE)"
            ),
            inline=False
        )
        
        # Footer
        embed.set_footer(text="ShadowIDE Discord Bot", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        await interaction.response.send_message(embed=embed)

    @commands.Cog.listener()
    async def on_message(self, message):
        """Handle message events for anti-spam."""
        # Ignore messages from bots
        if message.author.bot:
            return
            
        # Ignore messages from users with manage_messages permission
        if message.author.guild_permissions.manage_messages:
            return
            
        user_id = message.author.id
        current_time = datetime.datetime.now().timestamp()
        
        # Initialize user tracking if needed
        if user_id not in self.message_timestamps:
            self.message_timestamps[user_id] = []
            self.spam_warnings[user_id] = 0
            self.mute_durations[user_id] = "5m"  # Start with 5 minutes
            self.last_warning_time[user_id] = 0
            
        # Add current message timestamp
        self.message_timestamps[user_id].append(current_time)
        
        # Remove timestamps older than 7 seconds
        self.message_timestamps[user_id] = [
            ts for ts in self.message_timestamps[user_id] 
            if current_time - ts <= 7
        ]
        
        # Check if user sent more than 5 messages in 7 seconds
        if len(self.message_timestamps[user_id]) > 5:
            # Check if user is already muted
            muted_role = discord.utils.get(message.guild.roles, name="Muted")
            if muted_role and muted_role in message.author.roles:
                return
                
            # Check warning cooldown (5-10 seconds)
            if current_time - self.last_warning_time[user_id] < 5:
                return
                
            # Increment warning count
            self.spam_warnings[user_id] += 1
            
            # Update last warning time
            self.last_warning_time[user_id] = current_time
            
            # Get current warning count
            warning_count = self.spam_warnings[user_id]
            
            if warning_count <= 3:
                # Send warning message
                warning_msg = f"⚠️ {message.author.mention}, please slow down! (Warning {warning_count}/3)"
                await message.channel.send(warning_msg, delete_after=5)
                    
            else:
                # Mute the user with increasing duration
                current_duration = self.mute_durations[user_id]
                
                # Parse current duration
                time_delta, human_readable_duration = parse_time_string(current_duration)
                if not time_delta:
                    time_delta = datetime.timedelta(minutes=5)
                    human_readable_duration = "5m"
                
                # Double the duration for next time
                next_duration = f"{time_delta.total_seconds() * 2}s"
                self.mute_durations[user_id] = next_duration
                
                # Ensure muted role exists
                muted_role = await self.ensure_mute_role(message.guild)
                if not muted_role:
                    return
                
                # Mute the user
                try:
                    await message.author.add_roles(muted_role, reason="Anti-spam mute")
                    
                    # Add to database
                    end_time = get_future_timestamp(time_delta)
                    self.db.add_temp_mute(message.author.id, message.guild.id, end_time)
                    
                    # Create log embed
                    embed = await self.create_log_embed(
                        "Mute", 
                        message.author, 
                        self.bot.user,  # Bot as moderator
                        "Anti-spam protection", 
                        human_readable_duration
                    )
                    
                    # Log to the log channel
                    await log_to_channel(self.bot, embed)
                    
                    # Send mute message
                    mute_msg = f"🔇 {message.author.mention} has been muted for {human_readable_duration} due to spam."
                    await message.channel.send(mute_msg)
                    
                    # Try to DM the user
                    await self.send_dm(
                        message.author,
                        "muted",
                        message.guild.name,
                        "Anti-spam protection",
                        human_readable_duration
                    )
                    
                    # Reset warning count
                    self.spam_warnings[user_id] = 0
                    
                except discord.Forbidden:
                    pass
                except discord.HTTPException as e:
                    logger.error(f"Error muting user for spam: {e}")

async def setup(bot):
    await bot.add_cog(Moderation(bot)) 