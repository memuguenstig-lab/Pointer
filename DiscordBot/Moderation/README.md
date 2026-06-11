# ShadowIDE Discord Bot

A Discord bot for the [ShadowIDE](https://shadowide.f1shy312.com) project, providing moderation tools through slash commands.

## Features

- Moderation slash commands only
- Built using Python 3.11+ and discord.py 2.x
- DM notifications for moderation actions
- Logging to a designated channel
- Custom time durations (1m, 1h, 1d, 1w, 1mo)
- SQLite database for warnings and temporary punishments

### Moderation
- Temporary bans and mutes with automatic expiry
- Warning system with persistent storage
- Channel lockdown functionality
- Detailed user profiles with moderation histories
- Activity logging to a dedicated channel

### Ticket System
- Support ticket creation via interactive buttons
- Private ticket channels for user assistance
- Ticket management with staff controls
- Automated ticket transcripts
- Comprehensive ticket logging
- User notification system via DMs

## Commands

- `/ban` - Ban a user, with optional duration and reason
- `/unban` - Unban a user by ID
- `/kick` - Kick a user from the server
- `/mute` - Apply a muted role to a user for a specific duration
- `/unmute` - Remove the muted role from a user
- `/warn` - Add a warning to a user's record
- `/warnings` - View warnings for a specific user
- `/clear` - Delete a specified number of messages
- `/lock` - Prevent @everyone from sending messages in the current channel
- `/unlock` - Allow @everyone to send messages in the current channel
- `/say` - Make the bot send a message as an embed
- `/profile` - View detailed information about a user with interactive moderation buttons
- `/info` - Display information about the bot and server
- `/setup_tickets` - Set up the ticket system with channels for ticket creation, ticket handling, and logging

## Setup

1. **Prerequisites**
   - Python 3.11 or higher
   - Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
   - Administrator privileges in your Discord server
   - **Important**: When creating your bot on the Discord Developer Portal, make sure to enable the following Privileged Gateway Intents:
     - Server Members Intent
     - Presence Intent
     - Message Content Intent

2. **Installation**
   ```bash
   # Clone the repository (if using git)
   git clone <repository-url>
   cd discord-bot
   
   # Create and activate a virtual environment (optional but recommended)
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Configuration**
   - Copy `.env.example` to `.env`
   - Fill in your Discord token, guild ID, and log channel ID
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   GUILD_ID=your_guild_id_here
   LOG_CHANNEL_ID=your_log_channel_id_here
   ```

4. **Run the Bot**
   ```bash
   python main.py
   ```

## Directory Structure

```
├── main.py                 # Main bot entry point
├── cogs/
│   └── moderation.py       # Moderation commands
├── utils/
│   ├── db.py               # Database operations
│   ├── logger.py           # Logging utilities
│   └── time_converter.py   # Time format conversion
├── data/                   # Created automatically
│   └── moderation.db       # SQLite database
├── logs/                   # Created automatically
│   └── bot.log             # Log file
├── .env                    # Bot configuration (create from .env.example)
├── .env.example            # Example configuration file
└── requirements.txt        # Dependencies
```

## License

MIT 