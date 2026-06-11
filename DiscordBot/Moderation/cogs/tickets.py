import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, View
import asyncio
import datetime
import logging
import os
from typing import Optional, Dict
import io

logger = logging.getLogger('shadowide_bot')

# Persistent view for ticket creation
class TicketView(discord.ui.View):
    def __init__(self, bot):
        super().__init__(timeout=None)  # Make the view persistent
        self.bot = bot
    
    @discord.ui.button(
        label="Create Ticket", 
        style=discord.ButtonStyle.primary, 
        emoji="🎫", 
        custom_id="create_ticket"
    )
    async def create_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Create a support ticket when the button is clicked."""
        # Get ticket configuration
        ticket_category_id = int(os.getenv('TICKET_CATEGORY_ID', 0))
        
        # Get guild and member
        guild = interaction.guild
        member = interaction.user
        
        # Check if the ticket category exists
        category = guild.get_channel(ticket_category_id)
        if not category or not isinstance(category, discord.CategoryChannel):
            await interaction.response.send_message(
                "❌ The ticket category is not properly configured. Please contact an administrator.",
                ephemeral=True
            )
            logger.error(f"Ticket category with ID {ticket_category_id} not found or is not a category")
            return
        
        # Check if the user already has an open ticket
        for channel in category.channels:
            if channel.topic and f"Ticket for {member.id}" in channel.topic:
                await interaction.response.send_message(
                    f"❌ You already have an open ticket: {channel.mention}",
                    ephemeral=True
                )
                return
        
        # Create a new ticket channel
        ticket_number = len(category.channels) + 1
        channel_name = f"ticket-{ticket_number:04d}"
        
        # Set permissions for the ticket channel
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            member: discord.PermissionOverwrite(
                read_messages=True, 
                send_messages=True,
                embed_links=True,
                attach_files=True,
                read_message_history=True,
            ),
            guild.me: discord.PermissionOverwrite(
                read_messages=True,
                send_messages=True,
                manage_channels=True,
                manage_messages=True,
            )
        }
        
        # Add permissions for staff roles
        for role in guild.roles:
            # Check if role has manage_channels permission (staff role)
            if role.permissions.manage_channels and role != guild.default_role:
                overwrites[role] = discord.PermissionOverwrite(
                    read_messages=True,
                    send_messages=True,
                    manage_channels=True,
                )
        
        try:
            # Create the ticket channel
            channel = await category.create_text_channel(
                name=channel_name,
                topic=f"Ticket for {member.id} | Created by {member.name}",
                overwrites=overwrites,
                reason=f"Support ticket created by {member.name}"
            )
            
            # Send confirmation to user
            await interaction.response.send_message(
                f"✅ Your ticket has been created: {channel.mention}",
                ephemeral=True
            )
            
            # Create embed for the ticket channel
            embed = discord.Embed(
                title="🎫 Support Ticket",
                description=(
                    f"Thank you for creating a ticket, {member.mention}!\n\n"
                    "Please describe your issue or question, and a staff member will assist you as soon as possible.\n\n"
                    "Use the buttons below to manage this ticket."
                ),
                color=discord.Color.blue(),
                timestamp=datetime.datetime.now()
            )
            
            # Add ticket information
            embed.add_field(
                name="📋 Ticket Information",
                value=(
                    f"**Channel:** {channel.mention}\n"
                    f"**Created by:** {member.mention}\n"
                    f"**Created at:** <t:{int(datetime.datetime.now().timestamp())}:F>"
                ),
                inline=False
            )
            
            # Add instructions
            embed.add_field(
                name="📌 What to include",
                value=(
                    "• Describe your issue in detail\n"
                    "• Include any relevant screenshots\n"
                    "• Be patient while waiting for assistance"
                ),
                inline=True
            )
            
            # Add visual elements
            embed.set_thumbnail(url=member.display_avatar.url)
            embed.set_footer(text="ShadowIDE Support System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
            
            # Create ticket management view
            ticket_management = TicketManagementView(self.bot)
            
            # Send the welcome message with ticket management buttons
            await channel.send(
                content=f"{member.mention} Staff will be with you shortly.",
                embed=embed,
                view=ticket_management
            )
            
            # Log ticket creation to the ticket log channel
            await log_ticket_event(
                self.bot,
                guild,
                "Ticket Created",
                f"Ticket created by {member.mention}",
                discord.Color.green(),
                member=member,
                channel=channel
            )
            
            logger.info(f"Ticket created by {member.name} ({member.id}) - Channel: {channel.name}")
        except discord.Forbidden:
            await interaction.response.send_message(
                "❌ I don't have permission to create a ticket channel.",
                ephemeral=True
            )
        except discord.HTTPException as e:
            await interaction.response.send_message(
                f"❌ An error occurred while creating your ticket: {e}",
                ephemeral=True
            )
            logger.error(f"Error creating ticket for {member.name} ({member.id}): {e}")


class TicketManagementView(discord.ui.View):
    def __init__(self, bot):
        super().__init__(timeout=None)  # Make the view persistent
        self.bot = bot
    
    @discord.ui.button(
        label="Close Ticket", 
        style=discord.ButtonStyle.danger, 
        emoji="🔒", 
        custom_id="close_ticket"
    )
    async def close_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Close the ticket."""
        # Check if the user has permission to close tickets
        member = interaction.user
        if not member.guild_permissions.manage_channels and not f"Ticket for {member.id}" in interaction.channel.topic:
            await interaction.response.send_message(
                "❌ You don't have permission to close this ticket.",
                ephemeral=True
            )
            return
        
        # Ask for confirmation
        confirm_embed = discord.Embed(
            title="⚠️ Close Ticket",
            description=(
                "Are you sure you want to close this ticket?\n\n"
                "This will:\n"
                "• Lock the channel for all users\n"
                "• Generate a transcript of all messages\n"
                "• Delete the channel after 5 minutes\n\n"
                "This action cannot be undone."
            ),
            color=discord.Color.orange()
        )
        confirm_embed.set_footer(text="ShadowIDE Support System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        # Create confirmation buttons
        confirm_view = ConfirmView(self.bot, original_interaction=interaction)
        
        await interaction.response.send_message(
            embed=confirm_embed,
            view=confirm_view,
            ephemeral=True
        )
    
    @discord.ui.button(
        label="Add Member", 
        style=discord.ButtonStyle.secondary, 
        emoji="👥", 
        custom_id="add_member"
    )
    async def add_member(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Add a member to the ticket."""
        # Check if the user has permission to add members
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message(
                "❌ You don't have permission to add members to this ticket.",
                ephemeral=True
            )
            return
        
        # Create a modal for adding a member
        class AddMemberModal(discord.ui.Modal, title="Add Member to Ticket"):
            member_id = discord.ui.TextInput(
                label="Member ID or @mention",
                placeholder="Enter the member's ID or @mention",
                required=True
            )
            
            async def on_submit(self, modal_interaction: discord.Interaction):
                # Extract member ID from input (strip @ and <> if present)
                member_input = self.member_id.value.strip()
                if member_input.startswith("<@") and member_input.endswith(">"):
                    member_input = member_input[2:-1]
                    if member_input.startswith("!"):
                        member_input = member_input[1:]
                
                try:
                    member_id = int(member_input)
                    member = modal_interaction.guild.get_member(member_id)
                    
                    if not member:
                        await modal_interaction.response.send_message(
                            "❌ Member not found. Make sure they are in the server.",
                            ephemeral=True
                        )
                        return
                    
                    # Add member to the ticket
                    await modal_interaction.channel.set_permissions(
                        member,
                        read_messages=True,
                        send_messages=True,
                        embed_links=True,
                        attach_files=True,
                        read_message_history=True,
                    )
                    
                    await modal_interaction.response.send_message(
                        f"✅ Added {member.mention} to the ticket.",
                        ephemeral=False
                    )
                    
                    # Log member addition to the ticket log channel
                    await log_ticket_event(
                        self.view.bot,
                        modal_interaction.guild,
                        "Member Added to Ticket",
                        f"{member.mention} was added to {modal_interaction.channel.mention} by {modal_interaction.user.mention}",
                        discord.Color.blue(),
                        member=member,
                        channel=modal_interaction.channel,
                        moderator=modal_interaction.user
                    )
                    
                except ValueError:
                    await modal_interaction.response.send_message(
                        "❌ Invalid member ID. Please use a valid ID or @mention.",
                        ephemeral=True
                    )
        
        # Set up the modal with access to the bot
        modal = AddMemberModal()
        modal.view = self
        
        # Show the modal
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(
        label="Transcript", 
        style=discord.ButtonStyle.secondary, 
        emoji="📝", 
        custom_id="transcript"
    )
    async def transcript(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Generate a transcript of the ticket."""
        # Check if the user has permission to get transcripts
        if not interaction.user.guild_permissions.manage_channels and not f"Ticket for {interaction.user.id}" in interaction.channel.topic:
            await interaction.response.send_message(
                "❌ You don't have permission to get transcripts for this ticket.",
                ephemeral=True
            )
            return
        
        await interaction.response.defer(ephemeral=True, thinking=True)
        
        try:
            # Generate transcript
            transcript_file, transcript_text = await generate_transcript(interaction.channel)
            
            # Create an embed for the transcript
            transcript_embed = discord.Embed(
                title="📝 Ticket Transcript",
                description=(
                    f"Here is the transcript for {interaction.channel.mention}.\n\n"
                    "The transcript contains all messages from this ticket channel."
                ),
                color=discord.Color.blue(),
                timestamp=datetime.datetime.now()
            )
            
            # Add ticket information
            ticket_owner_id = None
            if interaction.channel.topic and "Ticket for" in interaction.channel.topic:
                try:
                    ticket_owner_id = int(interaction.channel.topic.split()[2])
                    ticket_owner = interaction.guild.get_member(ticket_owner_id)
                    if ticket_owner:
                        transcript_embed.add_field(
                            name="👤 Ticket Owner",
                            value=f"{ticket_owner.mention} (`{ticket_owner.id}`)",
                            inline=True
                        )
                except (ValueError, IndexError):
                    pass
            
            # Add stats about the transcript
            message_count = transcript_text.count('\n\n[') + 1  # Rough estimate of messages
            transcript_embed.add_field(
                name="📊 Transcript Info",
                value=(
                    f"**Messages:** ~{message_count}\n"
                    f"**Generated by:** {interaction.user.mention}\n"
                    f"**Generated at:** <t:{int(datetime.datetime.now().timestamp())}:F>"
                ),
                inline=True
            )
            
            # Add visual elements
            transcript_embed.set_thumbnail(url="https://shadowide.f1shy312.com/static/logo.png")
            transcript_embed.set_footer(text="ShadowIDE Support System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
            
            # Send the transcript file to the user
            await interaction.followup.send(
                embed=transcript_embed,
                file=transcript_file,
                ephemeral=True
            )
            
            # Create a new file object for the log (since the first one was consumed)
            log_transcript_file = discord.File(
                io.BytesIO(transcript_text.encode('utf-8')),
                filename=f"transcript-{interaction.channel.name}.txt"
            )
            
            # Log transcript generation to ticket log channel with the new file object
            await log_ticket_event(
                self.bot,
                interaction.guild,
                "Transcript Generated",
                f"Transcript generated for {interaction.channel.mention} by {interaction.user.mention}",
                discord.Color.blue(),
                channel=interaction.channel,
                moderator=interaction.user,
                transcript_file=log_transcript_file
            )
            
        except Exception as e:
            await interaction.followup.send(
                f"❌ An error occurred while generating the transcript: {e}",
                ephemeral=True
            )
            logger.error(f"Error generating transcript: {e}")


class ConfirmView(discord.ui.View):
    def __init__(self, bot, original_interaction):
        super().__init__(timeout=60)  # 60 second timeout
        self.bot = bot
        self.original_interaction = original_interaction
    
    @discord.ui.button(label="Confirm", style=discord.ButtonStyle.danger, emoji="✅")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        
        channel = interaction.channel
        guild = interaction.guild
        
        # Get the ticket owner's ID from the channel topic
        ticket_owner_id = None
        if channel.topic:
            # Extract the user ID from the topic (format: "Ticket for USER_ID | Created by USER_NAME")
            try:
                ticket_owner_id = int(channel.topic.split()[2])
            except (ValueError, IndexError):
                pass
        
        # Get ticket owner member object
        ticket_owner = None
        if ticket_owner_id:
            ticket_owner = interaction.guild.get_member(ticket_owner_id)
        
        # Generate transcript before closing
        transcript_file = None
        transcript_text = None
        try:
            transcript_file, transcript_text = await generate_transcript(channel)
        except Exception as e:
            logger.error(f"Error generating transcript during ticket close: {e}")
        
        # Send closing message
        closing_embed = discord.Embed(
            title="🔒 Ticket Closed",
            description=(
                f"This ticket has been closed by {interaction.user.mention}.\n\n"
                "The channel will be deleted in 5 minutes.\n"
                "A transcript has been saved for reference."
            ),
            color=discord.Color.red(),
            timestamp=datetime.datetime.now()
        )
        
        # Add ticket info
        if ticket_owner:
            closing_embed.add_field(
                name="📋 Ticket Information",
                value=(
                    f"**Opened by:** {ticket_owner.mention}\n"
                    f"**Closed by:** {interaction.user.mention}\n"
                    f"**Channel:** {channel.name}"
                ),
                inline=False
            )
        
        # Add visual elements
        closing_embed.set_thumbnail(url="https://shadowide.f1shy312.com/static/logo.png")
        closing_embed.set_footer(text="ShadowIDE Support System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        # Disable all buttons in the original view
        for child in self.children:
            child.disabled = True
        
        # Update the original message
        await interaction.edit_original_response(view=self)
        await channel.send(embed=closing_embed)
        
        # Create a new file object for the log channel (if transcript was generated successfully)
        log_transcript_file = None
        if transcript_text:
            log_transcript_file = discord.File(
                io.BytesIO(transcript_text.encode('utf-8')),
                filename=f"transcript-{channel.name}.txt"
            )
        
        # Log ticket closing to the ticket log channel
        await log_ticket_event(
            self.bot,
            interaction.guild,
            "Ticket Closed",
            f"Ticket {channel.name} was closed by {interaction.user.mention}",
            discord.Color.red(),
            member=ticket_owner if ticket_owner else None,
            channel=channel,
            moderator=interaction.user,
            transcript_file=log_transcript_file
        )
        
        # Notify the ticket owner if they're still in the server
        if ticket_owner and transcript_text:
            try:
                dm_embed = discord.Embed(
                    title="🎫 Ticket Closed",
                    description=(
                        f"Your ticket in **{interaction.guild.name}** has been closed by a staff member.\n\n"
                        "A transcript of the conversation is attached below for your records."
                    ),
                    color=discord.Color.red(),
                    timestamp=datetime.datetime.now()
                )
                
                # Add ticket info
                dm_embed.add_field(
                    name="📋 Ticket Information",
                    value=(
                        f"**Server:** {interaction.guild.name}\n"
                        f"**Ticket:** {channel.name}\n"
                        f"**Closed by:** {interaction.user.name}\n"
                        f"**Closed at:** <t:{int(datetime.datetime.now().timestamp())}:F>"
                    ),
                    inline=False
                )
                
                # Add visual elements
                dm_embed.set_thumbnail(url=interaction.guild.icon.url if interaction.guild.icon else "https://shadowide.f1shy312.com/static/logo.png")
                dm_embed.set_footer(text="ShadowIDE Support System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
                
                await ticket_owner.send(embed=dm_embed)
                
                # Create a new file object for the DM (since the previous ones were consumed)
                user_transcript_file = discord.File(
                    io.BytesIO(transcript_text.encode('utf-8')),
                    filename=f"transcript-{channel.name}.txt"
                )
                
                # Send the transcript to the user
                await ticket_owner.send(
                    content="📝 Here is a transcript of your closed ticket:",
                    file=user_transcript_file
                )
            except discord.Forbidden:
                # User has DMs disabled
                pass
        
        # Lock the channel properly
        try:
            # First, ensure nobody can see the channel except staff and the ticket creator
            await channel.set_permissions(guild.default_role, read_messages=False, send_messages=False)
            
            # Create a list to keep staff with access
            staff_roles = []
            for role in guild.roles:
                if role.permissions.manage_channels and role != guild.default_role:
                    staff_roles.append(role)
                    await channel.set_permissions(
                        role,
                        read_messages=True,
                        send_messages=False
                    )
            
            # Make sure the ticket creator can still view but not send messages
            if ticket_owner:
                await channel.set_permissions(
                    ticket_owner,
                    read_messages=True,
                    send_messages=False
                )
                
            # Ensure the bot can still manage the channel
            await channel.set_permissions(
                guild.me,
                read_messages=True,
                send_messages=True,
                manage_channels=True
            )
            
            # Let the user know the channel will be deleted
            await interaction.followup.send(
                "✅ Ticket closed. The channel will be deleted in 5 minutes.",
                ephemeral=True
            )
            
            # Wait 5 minutes then delete
            await asyncio.sleep(300)  # 5 minutes
            await channel.delete(reason=f"Ticket closed by {interaction.user.name}")
            
        except discord.Forbidden:
            await interaction.followup.send(
                "❌ I don't have permission to delete the channel.",
                ephemeral=True
            )
        except discord.HTTPException as e:
            await interaction.followup.send(
                f"❌ An error occurred while deleting the channel: {e}",
                ephemeral=True
            )
            logger.error(f"Error deleting ticket channel {channel.name}: {e}")
    
    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary, emoji="❌")
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        # Disable all buttons
        for child in self.children:
            child.disabled = True
        
        await interaction.response.edit_message(
            content="Action cancelled.",
            embed=None,
            view=self
        )


async def generate_transcript(channel):
    """Generate a transcript of the ticket channel."""
    try:
        messages = []
        async for message in channel.history(limit=500, oldest_first=True):
            # Format timestamp
            timestamp = message.created_at.strftime("%Y-%m-%d %H:%M:%S")
            
            # Format author
            author_name = message.author.name
            author_id = message.author.id
            
            # Format content
            content = message.content if message.content else "[No text content]"
            
            # Format attachments
            attachments = []
            for attachment in message.attachments:
                attachments.append(f"{attachment.filename}: {attachment.url}")
            attachments_text = "\n- ".join(attachments)
            
            # Format embeds
            embeds_text = ""
            for i, embed in enumerate(message.embeds):
                embed_parts = []
                
                if embed.title:
                    embed_parts.append(f"Title: {embed.title}")
                if embed.description:
                    embed_parts.append(f"Description: {embed.description}")
                if embed.fields:
                    fields_text = []
                    for field in embed.fields:
                        fields_text.append(f"{field.name}: {field.value}")
                    embed_parts.append("Fields: " + " | ".join(fields_text))
                
                if embed_parts:
                    embeds_text += f"\nEmbed {i+1}: {' | '.join(embed_parts)}"
            
            # Build message text
            msg_text = f"[{timestamp}] {author_name} (ID: {author_id}):"
            msg_text += f"\n{content}"
            
            if attachments:
                msg_text += f"\nAttachments:\n- {attachments_text}"
            
            if embeds_text:
                msg_text += embeds_text
            
            messages.append(msg_text)
        
        # Create the header
        channel_name = channel.name
        guild_name = channel.guild.name
        current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        header = [
            f"Transcript for #{channel_name} in {guild_name}",
            f"Generated: {current_time}",
            f"Total messages: {len(messages)}",
            "-" * 50  # Separator line
        ]
        
        # Create the transcript text
        transcript_text = "\n".join(header) + "\n\n" + "\n\n".join(messages)
        
        # Get ticket owner info for filename
        ticket_owner_id = "unknown"
        if channel.topic and "Ticket for" in channel.topic:
            try:
                ticket_owner_id = channel.topic.split()[2]
            except (IndexError, ValueError):
                pass
        
        # Create filename with timestamp to ensure uniqueness
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"transcript-{channel.name}-{ticket_owner_id}-{timestamp_str}.txt"
        
        # Create file object
        file = discord.File(
            io.BytesIO(transcript_text.encode('utf-8')), 
            filename=filename
        )
        
        return file, transcript_text
        
    except discord.Forbidden:
        logger.error(f"Forbidden error when generating transcript for {channel.name}")
        raise Exception("I don't have permission to read message history in this channel")
    except discord.HTTPException as e:
        logger.error(f"HTTP error when generating transcript: {e}")
        raise Exception(f"Discord API error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error generating transcript: {e}")
        raise Exception(f"An unexpected error occurred: {e}")


async def log_ticket_event(bot, guild, action, description, color, member=None, channel=None, moderator=None, transcript_file=None):
    """Log a ticket event to the ticket log channel."""
    # Get ticket log channel ID from environment variables
    ticket_log_channel_id = os.getenv('TICKET_LOG_CHANNEL_ID')
    if not ticket_log_channel_id:
        logger.warning("TICKET_LOG_CHANNEL_ID not set in .env file")
        return
    
    try:
        ticket_log_channel_id = int(ticket_log_channel_id)
        log_channel = bot.get_channel(ticket_log_channel_id)
        
        if not log_channel:
            logger.warning(f"Ticket log channel with ID {ticket_log_channel_id} not found")
            return
        
        # Select emoji based on action
        action_emoji = "🎫"
        if "Created" in action:
            action_emoji = "🆕"
        elif "Closed" in action:
            action_emoji = "🔒"
        elif "Transcript" in action:
            action_emoji = "📝"
        elif "Member" in action:
            action_emoji = "👥"
        elif "Setup" in action:
            action_emoji = "⚙️"
        
        # Create embed
        embed = discord.Embed(
            title=f"{action_emoji} {action}",
            description=description,
            color=color,
            timestamp=datetime.datetime.now()
        )
        
        # Format timestamp
        current_time = int(datetime.datetime.now().timestamp())
        timestamp_field = f"<t:{current_time}:F> (<t:{current_time}:R>)"
        
        # Add ticket information
        if channel:
            embed.add_field(
                name="📋 Ticket Information",
                value=(
                    f"**Channel:** {channel.mention}\n"
                    f"**Channel ID:** `{channel.id}`\n"
                    f"**Created:** <t:{int(channel.created_at.timestamp())}:R>"
                ),
                inline=True
            )
        
        # Add user information
        if member:
            member_info = (
                f"**Name:** {member.mention}\n"
                f"**ID:** `{member.id}`\n"
                f"**Account Created:** <t:{int(member.created_at.timestamp())}:R>"
            )
            if hasattr(member, 'joined_at') and member.joined_at:
                member_info += f"\n**Joined Server:** <t:{int(member.joined_at.timestamp())}:R>"
            
            embed.add_field(name="👤 User Information", value=member_info, inline=True)
            embed.set_thumbnail(url=member.display_avatar.url)
        
        # Add moderator information
        if moderator:
            embed.add_field(
                name="🛡️ Staff Member",
                value=(
                    f"**Name:** {moderator.mention}\n"
                    f"**ID:** `{moderator.id}`"
                ),
                inline=False
            )
        
        # Add action timestamp
        embed.add_field(
            name="⏰ Timestamp",
            value=timestamp_field,
            inline=False
        )
        
        # Add footer
        if transcript_file:
            embed.add_field(
                name="📎 Attachments",
                value="Transcript file attached to this message",
                inline=False
            )
            
        embed.set_footer(
            text=f"ShadowIDE Ticket System | {guild.name}",
            icon_url="https://shadowide.f1shy312.com/static/logo.png"
        )
        
        # Send message with or without transcript
        try:
            if transcript_file:
                # Make sure the transcript file exists and isn't None
                await log_channel.send(embed=embed, file=transcript_file)
                logger.info(f"Logged ticket event: {action} with transcript")
            else:
                await log_channel.send(embed=embed)
                logger.info(f"Logged ticket event: {action}")
        except Exception as e:
            # If there's an error sending with the file, try without it
            logger.error(f"Error sending transcript file to log channel: {e}")
            await log_channel.send(
                content="⚠️ Failed to attach transcript file due to an error.",
                embed=embed
            )
        
    except ValueError as e:
        logger.error(f"Invalid ticket log channel ID: {e}")
    except discord.HTTPException as e:
        logger.error(f"Discord HTTP error when logging ticket event: {e}")
    except Exception as e:
        logger.error(f"Unexpected error logging ticket event: {e}")


class Tickets(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
        # Register the persistent views when the cog is loaded
        self.bot.add_view(TicketView(bot))
        self.bot.add_view(TicketManagementView(bot))
    
    @commands.Cog.listener()
    async def on_ready(self):
        """Automatically check and set up the ticket message when the bot is ready."""
        # Get ticket channel ID from environment variables
        ticket_channel_id = os.getenv('TICKET_CHANNEL_ID')
        if not ticket_channel_id:
            logger.warning("TICKET_CHANNEL_ID not set in .env file")
            return
        
        try:
            ticket_channel_id = int(ticket_channel_id)
            channel = self.bot.get_channel(ticket_channel_id)
            
            if not channel:
                logger.warning(f"Ticket channel with ID {ticket_channel_id} not found")
                return
            
            # Check if the ticket message already exists
            message_found = False
            async for message in channel.history(limit=10):
                if message.author == self.bot.user and message.components:
                    for component in message.components:
                        for child in component.children:
                            if child.custom_id == "create_ticket":
                                message_found = True
                                break
                        if message_found:
                            break
                if message_found:
                    break
            
            # If no ticket message found, create one
            if not message_found:
                await self.setup_ticket_message(channel)
                logger.info(f"Ticket message created in channel {channel.name}")
        except (ValueError, discord.HTTPException) as e:
            logger.error(f"Error setting up ticket message: {e}")
    
    async def setup_ticket_message(self, channel):
        """Set up the ticket creation message with button."""
        embed = discord.Embed(
            title="🎫 Support Tickets",
            description=(
                "Need help or have questions about ShadowIDE? Click the button below to create a support ticket.\n\n"
                "A private channel will be created where you can discuss your issue with our staff members."
            ),
            color=discord.Color.blue(),
            timestamp=datetime.datetime.now()
        )
        
        # Add info field with ticket information
        embed.add_field(
            name="📝 What are tickets for?",
            value=(
                "• Bug reports\n"
                "• Feature requests\n"
                "• Account issues\n"
                "• General support\n"
                "• Other concerns"
            ),
            inline=True
        )
        
        # Add how it works field
        embed.add_field(
            name="⚙️ How it works",
            value=(
                "1. Click the button below\n"
                "2. A private channel is created\n"
                "3. Describe your issue\n"
                "4. Staff will respond ASAP"
            ),
            inline=True
        )
        
        # Add a thumbnail
        embed.set_thumbnail(url="https://shadowide.f1shy312.com/static/logo.png")
        embed.set_footer(text="ShadowIDE Support System", icon_url="https://shadowide.f1shy312.com/static/logo.png")
        
        # Create the ticket view with the create ticket button
        view = TicketView(self.bot)
        
        await channel.send(embed=embed, view=view)
    
    @app_commands.command(
        name="setup_tickets",
        description="Set up the ticket system in the specified channel"
    )
    @app_commands.describe(
        channel="The channel where the ticket creation message will be posted",
        category="The category where ticket channels will be created",
        log_channel="The channel where ticket logs and transcripts will be sent"
    )
    @app_commands.default_permissions(administrator=True)
    async def setup_tickets(
        self, 
        interaction: discord.Interaction, 
        channel: discord.TextChannel,
        category: discord.CategoryChannel,
        log_channel: discord.TextChannel
    ):
        """Set up the ticket system."""
        # Update the .env file with the new channel and category IDs
        with open(".env", "r") as f:
            env_content = f.read()
        
        # Check if the env variables already exist
        if "TICKET_CHANNEL_ID" in env_content:
            env_content = "\n".join([
                line for line in env_content.split("\n") 
                if not line.startswith("TICKET_CHANNEL_ID=")
            ])
        
        if "TICKET_CATEGORY_ID" in env_content:
            env_content = "\n".join([
                line for line in env_content.split("\n") 
                if not line.startswith("TICKET_CATEGORY_ID=")
            ])
        
        if "TICKET_LOG_CHANNEL_ID" in env_content:
            env_content = "\n".join([
                line for line in env_content.split("\n") 
                if not line.startswith("TICKET_LOG_CHANNEL_ID=")
            ])
        
        # Add the new env variables
        env_content += f"\n\n# Ticket System Configuration\nTICKET_CHANNEL_ID={channel.id}\nTICKET_CATEGORY_ID={category.id}\nTICKET_LOG_CHANNEL_ID={log_channel.id}\n"
        
        # Write the updated content back to the .env file
        with open(".env", "w") as f:
            f.write(env_content)
        
        # Update the environment variables in the current process
        os.environ["TICKET_CHANNEL_ID"] = str(channel.id)
        os.environ["TICKET_CATEGORY_ID"] = str(category.id)
        os.environ["TICKET_LOG_CHANNEL_ID"] = str(log_channel.id)
        
        # Create the ticket message
        await self.setup_ticket_message(channel)
        
        # Send test log message
        await log_ticket_event(
            self.bot,
            interaction.guild,
            "Ticket System Setup",
            f"Ticket system was set up by {interaction.user.mention}",
            discord.Color.green(),
            moderator=interaction.user
        )
        
        await interaction.response.send_message(
            f"✅ Ticket system set up successfully!\n"
            f"Ticket Channel: {channel.mention}\n"
            f"Ticket Category: {category.name}\n"
            f"Log Channel: {log_channel.mention}",
            ephemeral=True
        )
        
        logger.info(f"Ticket system set up by {interaction.user.name} in {channel.name} with log channel {log_channel.name}")


async def setup(bot):
    await bot.add_cog(Tickets(bot)) 