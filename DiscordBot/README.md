# ShadowIDE Discord Bot Suite

Comprehensive Discord bot ecosystem for the ShadowIDE community featuring economy, moderation, giveaways, leveling, and community management tools. Built with Python and discord.py.

![Python](https://img.shields.io/badge/Python-Bot-green) ![Discord.py](https://img.shields.io/badge/discord.py-Library-blue) ![SQLite](https://img.shields.io/badge/SQLite-Database-orange)

## 🤖 Bot Components

### 🎮 **Community Bot** - Economy & Fun Features
> Comprehensive community engagement with economy, leveling, giveaways, and entertainment features.

**Location**: `DiscordBot/Community/`

### 🛡️ **Moderation Bot** - Server Management
> Professional moderation tools with ticketing, logging, and advanced user management.

**Location**: `DiscordBot/Moderation/`

## ✨ Features Overview

### Community Bot Features
- 💰 **Economy System** - Virtual currency with jobs, gambling, and trading
- 🛒 **Shop & Inventory** - Buy, sell, and use items with persistent storage
- 🎁 **Giveaway System** - Host custom giveaways with role and balance requirements
- 📈 **Leveling System** - XP progression with rewards and leaderboards
- 💼 **Job System** - Passive income with various job options
- 🎮 **Fun Commands** - Entertainment, utility, and social features
- 📊 **Leaderboards** - Rich users, top XP earners, and statistics

### Moderation Bot Features
- 🛡️ **Moderation Tools** - Ban, kick, mute, warn with time-based punishments
- 🎫 **Ticket System** - Support tickets with transcripts and logging
- 📊 **User Profiles** - Detailed member info with moderation history
- 🔒 **Channel Management** - Lock/unlock channels with permissions
- 📝 **Comprehensive Logging** - All actions logged to designated channels
- ⚡ **Slash Commands** - Modern Discord command interface
- 📋 **Warning System** - Persistent warning storage and management

## 🚀 Quick Start

### Prerequisites
- **Python** (v3.8 or higher)
- **Discord Bot Token** ([Discord Developer Portal](https://discord.com/developers/applications))
- **Discord Server** with Administrator permissions

### Bot Permissions Required

**Community Bot Permissions:**
- Send Messages, Embed Links, Attach Files
- Read Message History, Add Reactions
- Use Slash Commands, Manage Messages (for giveaways)

**Moderation Bot Permissions:**
- Administrator (recommended) or:
- Ban Members, Kick Members, Manage Channels
- Manage Roles, Manage Messages, View Audit Log
- Send Messages, Embed Links, Use Slash Commands

### Community Bot Setup

1. **Navigate to Community Bot**
   ```bash
   cd DiscordBot/Community
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   cp .example .env
   ```

4. **Edit Configuration** (`.env`)
   ```env
   # Required
   DISCORD_TOKEN=your_discord_bot_token_here
   GUILD_ID=your_guild_id_here
   LOG_CHANNEL_ID=channel_id_for_logs
   SHADOWIDE_COIN_EMOJI_ID=emoji_id_for_shadowide_coin
   
   # Optional
   GIVEAWAY_PING_ROLE_ID=role_id_to_ping_for_giveaways
   ```

5. **Start Community Bot**
   ```bash
   python main.py
   ```

### Moderation Bot Setup

1. **Navigate to Moderation Bot**
   ```bash
   cd DiscordBot/Moderation
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   cp .example .env
   ```

4. **Edit Configuration** (`.env`)
   ```env
   # Required
   DISCORD_TOKEN=your_discord_bot_token_here
   GUILD_ID=your_guild_id_here
   LOG_CHANNEL_ID=your_log_channel_id_here
   ```

5. **Start Moderation Bot**
   ```bash
   python main.py
   ```

### Start All Bots (Linux/macOS)

```bash
# Make script executable
chmod +x start_bots.sh

# Start all bots
./start_bots.sh
```

## 📋 Community Bot Commands

### 💰 Economy Commands
- `/balance [user]` - View current balance
- `/pay <user> <amount>` - Send coins to another user
- `/daily` - Claim daily reward (24-hour cooldown)
- `/work` - Earn coins by working
- `/beg` - Beg for coins (small random amount)
- `/rob <user>` - Attempt to steal coins (risky!)
- `/slots <amount>` - Play the slot machine
- `/gamble <amount>` - Gamble your coins (50/50 chance)

### 🛒 Shop & Inventory Commands  
- `/shop` - View available items in the shop
- `/buy <item> [quantity]` - Purchase an item from the shop
- `/sell <item> [quantity]` - Sell an item from your inventory
- `/inventory [user]` - View your or another user's inventory
- `/use <item>` - Use an item from your inventory

### 🎁 Giveaway Commands
- `/giveaway start <duration> <prize> [min_balance] [required_role]` - Start a giveaway
- `/giveaway end <message_id>` - End a giveaway early
- `/giveaway reroll <message_id>` - Reroll a giveaway winner
- `/giveaway cancel <message_id>` - Cancel an active giveaway

### 📈 Leveling Commands
- `/rank [user]` - View your or another user's rank and XP
- `/leaderboard xp` - View XP leaderboard
- `/leaderboard coins` - View richest users

### 💼 Jobs Commands
- `/job apply <job>` - Apply for a job (one at a time)
- `/job resign` - Resign from your current job
- `/job stats` - View job statistics and available positions

### 🎮 Fun Commands
- `/8ball <question>` - Ask the magic 8-ball a question
- `/roll [max]` - Roll a random number (1 to max, default 100)
- `/coinflip` - Flip a coin (heads or tails)
- `/userinfo [user]` - View detailed user information
- `/avatar [user]` - View user's avatar in full size
- `/profile [user]` - View comprehensive user profile

### ⚙️ Admin Commands
- `/addcoins <user> <amount>` - Add coins to a user's balance
- `/removecoins <user> <amount>` - Remove coins from a user
- `/resetcoins <user>` - Reset a user's coins to 0
- `/shop add <id> <name> <price> <description> <usable>` - Add item to shop
- `/shop remove <id>` - Remove an item from the shop

## 🛡️ Moderation Bot Commands

### 🔨 Moderation Commands
- `/ban <user> [duration] [reason]` - Ban a user (permanent or temporary)
- `/unban <user_id>` - Unban a user by their ID
- `/kick <user> [reason]` - Kick a user from the server
- `/mute <user> <duration> [reason]` - Mute a user for specified time
- `/unmute <user>` - Remove mute from a user
- `/warn <user> <reason>` - Add a warning to a user's record
- `/warnings <user>` - View all warnings for a user
- `/clear <amount> [user]` - Delete messages (optionally from specific user)

### 🔒 Channel Management
- `/lock [channel] [reason]` - Prevent @everyone from sending messages
- `/unlock [channel]` - Allow @everyone to send messages again

### 📊 Information Commands
- `/profile <user>` - View detailed user info with moderation buttons
- `/userinfo <user>` - Display comprehensive user information
- `/info` - Display bot and server information

### 🎫 Ticket System
- `/setup_tickets` - Initialize the ticket system (Admin only)
  - Creates ticket creation channels
  - Sets up ticket handling categories
  - Configures logging channels

### 💬 Utility Commands
- `/say <message>` - Make the bot send a message as an embed

## 📁 Project Structure

```
DiscordBot/
├── Community/                    # Community Bot
│   ├── cogs/                     # Command modules
│   │   ├── economy.py            # Economy system commands
│   │   ├── giveaways.py          # Giveaway management
│   │   ├── leveling.py           # XP and leveling system
│   │   ├── jobs.py               # Job system
│   │   └── fun.py                # Fun and utility commands
│   ├── utils/                    # Utility modules
│   │   ├── database.py           # Database operations
│   │   ├── economy_utils.py      # Economy helper functions
│   │   └── time_utils.py         # Time parsing utilities
│   ├── data/                     # Database files (auto-created)
│   │   ├── economy.db            # Economy data
│   │   ├── giveaways.db          # Giveaway data
│   │   └── levels.db             # Leveling data
│   ├── main.py                   # Community bot entry point
│   ├── requirements.txt          # Community bot dependencies
│   ├── .example                  # Example environment file
│   └── README.md                 # Community bot documentation
├── Moderation/                   # Moderation Bot
│   ├── cogs/                     # Command modules
│   │   ├── moderation.py         # Moderation commands
│   │   ├── tickets.py            # Ticket system
│   │   └── logging.py            # Event logging
│   ├── utils/                    # Utility modules
│   │   ├── db.py                 # Database operations
│   │   ├── logger.py             # Logging utilities
│   │   └── time_converter.py     # Time format conversion
│   ├── data/                     # Database files (auto-created)
│   │   ├── moderation.db         # Moderation data
│   │   └── tickets.db            # Ticket data
│   ├── logs/                     # Log files (auto-created)
│   │   └── bot.log               # Application logs
│   ├── main.py                   # Moderation bot entry point
│   ├── requirements.txt          # Moderation bot dependencies
│   ├── .example                  # Example environment file
│   └── README.md                 # Moderation bot documentation
├── start_bots.sh                 # Start all bots script
└── README.md                     # This file
```

## ⚙️ Configuration

### Time Formats

Both bots support flexible time formats:

- `1m` - 1 minute
- `1h` - 1 hour  
- `1d` - 1 day
- `1w` - 1 week
- `1mo` - 1 month

### Database Management

**Automatic Database Creation**: Databases are created automatically on first run.

**Backup Databases**:
```bash
# Community bot
cp DiscordBot/Community/data/*.db /backup/location/

# Moderation bot  
cp DiscordBot/Moderation/data/*.db /backup/location/
```

**Reset Databases** (if needed):
```bash
# Remove database files to reset
rm DiscordBot/Community/data/*.db
rm DiscordBot/Moderation/data/*.db
```

### Customization

**Economy Settings** (Community Bot):
Edit values in `Community/main.py`:
```python
# Daily reward amount
DAILY_REWARD = 100

# Work command earnings range
WORK_MIN = 50
WORK_MAX = 200

# Starting balance for new users
STARTING_BALANCE = 1000
```

**Moderation Settings** (Moderation Bot):
Edit values in `Moderation/main.py`:
```python
# Default mute duration
DEFAULT_MUTE_DURATION = "1h"

# Maximum warning count before auto-action
MAX_WARNINGS = 5
```

## 🛠️ Troubleshooting

### Common Issues

**Bot Won't Start**
```bash
# Check Python version
python --version

# Verify dependencies
pip install -r requirements.txt

# Check token validity
# Regenerate token in Discord Developer Portal if needed
```

**Permission Errors**
```bash
# Ensure bot has required permissions in Discord server
# Check role hierarchy (bot role should be above moderated roles)
# Verify bot has slash command permissions
```

**Database Errors**
```bash
# Check file permissions
chmod 666 data/*.db

# Reset database if corrupted
rm data/*.db
# Bot will recreate on next start
```

**Command Not Working**
```bash
# Sync slash commands manually (in bot code):
# await bot.tree.sync()

# Check bot is in correct server
# Verify GUILD_ID in .env file
```

### Debug Mode

Enable detailed logging by editing the main.py files:

```python
import logging

# Set to DEBUG for detailed logs
logging.basicConfig(level=logging.DEBUG)
```

### Performance Optimization

**For Large Servers**:
- Implement command cooldowns
- Use database indexing for frequent queries
- Limit leaderboard sizes
- Archive old data periodically

## 🔄 Updates & Maintenance

### Updating Dependencies

```bash
# Update all dependencies
pip install -r requirements.txt --upgrade

# Update specific package
pip install discord.py --upgrade
```

### Bot Maintenance

**Regular Tasks**:
- Monitor bot uptime and performance
- Review and clean old data periodically  
- Update bot permissions as server grows
- Backup databases regularly
- Monitor for Discord API changes

### Adding New Features

**Community Bot Extensions**:
1. Create new cog in `cogs/` directory
2. Add database tables if needed
3. Register cog in `main.py`
4. Test thoroughly before deployment

**Moderation Bot Extensions**:
1. Follow same pattern as existing cogs
2. Ensure proper logging integration
3. Add appropriate permission checks
4. Test with various user roles

## 🤝 Contributing to Discord Bots

### Development Guidelines

- **Follow discord.py best practices**
- **Use slash commands** for new features
- **Implement proper error handling**
- **Add comprehensive logging**
- **Test with different permission levels**

### Code Style

- **Use async/await** for all Discord operations
- **Handle rate limits** gracefully
- **Validate user input** thoroughly
- **Use type hints** where possible

### Testing Checklist

- [ ] Commands work with various permission levels
- [ ] Error handling displays helpful messages
- [ ] Database operations are atomic
- [ ] Slash commands sync properly
- [ ] Bot handles server outages gracefully

## 📝 License

This component is part of the ShadowIDE project, licensed under the MIT License.

## 🙏 Acknowledgments

- **discord.py** - Excellent Discord library for Python
- **SQLite** - Lightweight database for bot data
- **Discord Developer Community** - Support and resources
- **Python Community** - Amazing ecosystem and libraries

---

**[← Back to Main README](../README.md)** | **[Code Editor Component →](../App/README.md)** | **[Website Component →](../Website/README.md)** 