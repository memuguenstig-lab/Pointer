import logging
import os
from logging.handlers import RotatingFileHandler

def setup_logger():
    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    # Set up logger
    logger = logging.getLogger('shadowide_bot')
    logger.setLevel(logging.INFO)
    
    # Set up console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(console_format)
    
    # Set up file handler for all logs
    file_handler = RotatingFileHandler(
        'logs/bot.log',
        maxBytes=5_000_000,  # 5MB
        backupCount=5
    )
    file_handler.setLevel(logging.INFO)
    file_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(file_format)
    
    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger

def log_to_channel(bot, embed):
    """
    Send a log message to the designated log channel.
    
    Args:
        bot: The bot instance
        embed: The discord.Embed to send
    """
    if bot.log_channel:
        return bot.loop.create_task(bot.log_channel.send(embed=embed))
    return None 