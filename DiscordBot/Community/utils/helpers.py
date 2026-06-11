import discord
import os
import random
import asyncio
from datetime import datetime, timedelta
import logging
from typing import Optional, List, Dict, Any, Union

logger = logging.getLogger('shadowide_bot')

# Get shadowide coin emoji
def get_coin_emoji():
    """Get the ShadowIDE Coin emoji"""
    emoji_id = os.getenv('SHADOWIDE_COIN_EMOJI_ID')
    if emoji_id:
        return f"{emoji_id}"
    return "🪙"  # Fallback emoji

def get_xp_emoji():
    """Get the XP emoji"""
    emoji_id = os.getenv('XP_ICON_ID')
    if emoji_id:
        return f"{emoji_id}"
    return "💰"  # Fallback emoji

# Format timestamp
def format_timestamp(timestamp, format_str="%Y-%m-%d %H:%M:%S"):
    """Format a timestamp"""
    return datetime.fromtimestamp(timestamp).strftime(format_str)

# Time conversion helpers
def parse_time(time_str):
    """Convert a time string (1d, 2h, 30m, etc.) to seconds"""
    if not time_str:
        return None

    total_seconds = 0
    
    # Handle days (d)
    if 'd' in time_str:
        parts = time_str.split('d')
        try:
            days = int(parts[0])
            total_seconds += days * 86400  # 24 * 60 * 60
            time_str = parts[1]
        except ValueError:
            return None
    
    # Handle hours (h)
    if 'h' in time_str:
        parts = time_str.split('h')
        try:
            hours = int(parts[0])
            total_seconds += hours * 3600  # 60 * 60
            time_str = parts[1]
        except ValueError:
            return None
    
    # Handle minutes (m)
    if 'm' in time_str:
        parts = time_str.split('m')
        try:
            minutes = int(parts[0])
            total_seconds += minutes * 60
            time_str = parts[1]
        except ValueError:
            return None
    
    # Handle seconds (s)
    if 's' in time_str:
        parts = time_str.split('s')
        try:
            seconds = int(parts[0])
            total_seconds += seconds
        except ValueError:
            return None
            
    return total_seconds

def seconds_to_dhms(seconds):
    """Convert seconds to days, hours, minutes, seconds string format"""
    days, remainder = divmod(seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    
    result = ""
    if days > 0:
        result += f"{days}d "
    if hours > 0:
        result += f"{hours}h "
    if minutes > 0:
        result += f"{minutes}m "
    if seconds > 0 or not result:
        result += f"{seconds}s"
        
    return result.strip()

def format_time_until(target_timestamp):
    """Format the time until a given timestamp"""
    now = datetime.now().timestamp()
    remaining = target_timestamp - now
    
    if remaining <= 0:
        return "now"
        
    return seconds_to_dhms(int(remaining))

# Discord helper functions
async def send_dm(user, content=None, embed=None):
    """
    Safely send a DM to a user
    
    Returns:
        bool: Whether the DM was sent successfully
    """
    try:
        if content:
            await user.send(content=content)
        if embed:
            await user.send(embed=embed)
        return True
    except (discord.Forbidden, discord.HTTPException) as e:
        logger.warning(f"Failed to send DM to {user}: {e}")
        return False

def create_embed(title, description=None, color=discord.Color.blue(), fields=None, footer=None, thumbnail=None, image=None):
    """
    Create a Discord embed with common formatting
    
    Parameters:
    -----------
    title : str
        The embed title
    description : str, optional
        The embed description
    color : discord.Color, optional
        The embed color
    fields : list of dict, optional
        A list of field dicts with keys 'name', 'value', 'inline'
    footer : str, optional
        The text for the footer
    thumbnail : str, optional
        URL for the thumbnail
    image : str, optional
        URL for the main image
        
    Returns:
    --------
    discord.Embed
        The formatted embed
    """
    embed = discord.Embed(title=title, description=description, color=color, timestamp=datetime.now())
    
    if fields:
        for field in fields:
            embed.add_field(
                name=field.get("name", ""),
                value=field.get("value", ""),
                inline=field.get("inline", False)
            )
    
    if footer:
        embed.set_footer(text=footer)
        
    if thumbnail:
        embed.set_thumbnail(url=thumbnail)
        
    if image:
        embed.set_image(url=image)
        
    return embed

def create_progress_bar(current, maximum, length=10, fill_char="▰", empty_char="▱"):
    """
    Create a text-based progress bar
    
    Parameters:
    -----------
    current : int
        Current value
    maximum : int
        Maximum value
    length : int, optional
        Length of the progress bar
    fill_char : str, optional
        Character for filled portion
    empty_char : str, optional
        Character for empty portion
        
    Returns:
    --------
    str
        The formatted progress bar
    """
    if maximum <= 0:
        return empty_char * length
        
    filled_length = int(length * current / maximum)
    bar = fill_char * filled_length + empty_char * (length - filled_length)
    
    return bar

def calculate_xp_for_level(level):
    """Calculate XP required for a specific level"""
    # More balanced XP curve
    # Level 1: 100 XP
    # Level 2: 300 XP
    # Level 3: 600 XP
    # Level 4: 1000 XP
    # And so on...
    return int(100 * (level * (level + 1)) / 2)

def calculate_level_for_xp(xp):
    """Calculate level for a given amount of XP"""
    # Solve quadratic equation: xp = 100 * (level * (level + 1)) / 2
    # level^2 + level - (2 * xp / 100) = 0
    # Using quadratic formula: (-b + sqrt(b^2 - 4ac)) / 2a
    a = 1
    b = 1
    c = -2 * xp / 100
    level = (-b + (b**2 - 4*a*c)**0.5) / (2*a)
    return int(level)

# Random chance-based functions
def chance(percentage):
    """Return True with a certain percentage chance"""
    return random.random() * 100 < percentage

def random_amount(min_amount, max_amount):
    """Get a random amount between min and max"""
    return random.randint(min_amount, max_amount)
