# ShadowIDE Discord Bot

A comprehensive Discord bot for the ShadowIDE community with economy, giveaways, leveling, and fun features.

## Features

- **Economy System** - Currency management with earning, spending, and gambling options
- **Shop & Inventory** - Buy, sell, and use items with persistent inventory
- **Giveaways** - Host custom giveaways with various requirements
- **Leveling** - User progression system with XP and rewards
- **Jobs** - Passive income system with various job options
- **Fun Commands** - Various utility and entertainment commands

## Setup

1. Clone this repository
2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in your configuration:
   ```
   # Discord Bot Token (required)
   DISCORD_TOKEN=your_token_here
   
   # Guild ID for slash command registration (required)
   GUILD_ID=your_guild_id_here
   
   # Log channel for bot notifications (required)
   LOG_CHANNEL_ID=channel_id_for_logs
   
   # Emoji ID for the ShadowIDE Coin (required)
   SHADOWIDE_COIN_EMOJI_ID=emoji_id_for_shadowide_coin
   
   # Role ID to ping for giveaways (optional)
   GIVEAWAY_PING_ROLE_ID=role_id_to_ping_for_giveaways
   ```
4. Run the bot:
   ```
   python main.py
   ```

## Commands

### Economy Commands
- `/balance` - View your current balance
- `/pay <user> <amount>` - Send coins to another user
- `/daily` - Claim daily reward
- `/work` - Earn coins by working
- `/beg` - Beg for coins (small random amount)
- `/rob <user>` - Attempt to steal coins (risky)
- `/slots <amount>` - Play the slot machine
- `/gamble <amount>` - Gamble your coins
- `/leaderboard` - View richest users

### Shop & Inventory Commands
- `/shop` - View available items in the shop
- `/buy <item> [quantity]` - Purchase an item
- `/sell <item> [quantity]` - Sell an item
- `/inventory` - View your inventory
- `/use <item>` - Use an item from your inventory

### Giveaway Commands
- `/giveaway <prize> <duration> [winners] [description] [channel]` - Create a new giveaway
- `/gsetreq <giveaway_id> [required_roles] [min_level] [min_balance] [min_messages]` - Set requirements for a giveaway
- `/greq <giveaway_id>` - Check requirements for a giveaway
- `/gstatus <giveaway_id>` - Check status of a giveaway
- `/gend <giveaway_id>` - End a giveaway early
- `/gendexpired` - End all expired giveaways
- `/greroll <giveaway_id> [winners] [exclude_user]` - Reroll a giveaway, optionally excluding a specific user
- `/grig <giveaway_id> <winners>` - Rig a giveaway for a specific user (100% win rate)
- `/gunrig <giveaway_id>` - Remove rigging from a giveaway
- `/gcancel <giveaway_id>` - Cancel a giveaway
- `/glist` - List active giveaways
- `/messages [user]` - Check message count for yourself or another user

### Leveling Commands
- `/rank [user]` - View your or another user's rank
- `/leaderboard xp` - View XP leaderboard

### Jobs Commands
- `/job apply <job>` - Apply for a job
- `/job resign` - Resign from your current job
- `/job stats` - View job statistics

### Fun Commands
- `/8ball <question>` - Ask the magic 8-ball
- `/roll [max]` - Roll a random number
- `/coinflip` - Flip a coin
- `/userinfo [user]` - View user information
- `/avatar [user]` - View user's avatar
- `/profile [user]` - View user's profile with detailed stats

### Admin Commands
- `/addcoins <user> <amount>` - Add coins to a user
- `/removecoins <user> <amount>` - Remove coins from a user
- `/resetcoins <user>` - Reset a user's coins
- `/shop add <id> <name> <price> <description> <usable>` - Add an item to the shop
- `/shop remove <id>` - Remove an item from the shop

## License

This project is licensed under the MIT License - see the LICENSE file for details. 