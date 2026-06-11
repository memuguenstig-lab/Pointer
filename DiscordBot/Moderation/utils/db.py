import sqlite3
import os
import logging
from datetime import datetime

logger = logging.getLogger('shadowide_bot')

class Database:
    def __init__(self, db_path="data/moderation.db"):
        # Ensure data directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        self.db_path = db_path
        self.conn = None
        self.initialize_db()
    
    def initialize_db(self):
        """Initialize the database connection and create tables if they don't exist."""
        try:
            self.conn = sqlite3.connect(self.db_path)
            cursor = self.conn.cursor()
            
            # Create warnings table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                moderator_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
            ''')
            
            # Create temp_bans table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_bans (
                user_id INTEGER PRIMARY KEY,
                guild_id INTEGER NOT NULL,
                end_time INTEGER NOT NULL
            )
            ''')
            
            # Create temp_mutes table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_mutes (
                user_id INTEGER PRIMARY KEY,
                guild_id INTEGER NOT NULL,
                end_time INTEGER NOT NULL
            )
            ''')
            
            self.conn.commit()
            logger.info("Database initialized successfully.")
        except sqlite3.Error as e:
            logger.error(f"Database initialization error: {e}")
            if self.conn:
                self.conn.close()
                self.conn = None
    
    def _ensure_connection(self):
        """Ensure that the database connection is established."""
        if not self.conn:
            self.conn = sqlite3.connect(self.db_path)
    
    # Warning methods
    def add_warning(self, user_id, moderator_id, reason):
        """Add a warning for a user."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            timestamp = int(datetime.now().timestamp())
            
            cursor.execute(
                "INSERT INTO warnings (user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?)",
                (user_id, moderator_id, reason, timestamp)
            )
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            logger.error(f"Error adding warning: {e}")
            return None
    
    def get_warnings(self, user_id):
        """Get all warnings for a user."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute(
                "SELECT id, moderator_id, reason, timestamp FROM warnings WHERE user_id = ? ORDER BY timestamp DESC",
                (user_id,)
            )
            return cursor.fetchall()
        except sqlite3.Error as e:
            logger.error(f"Error getting warnings: {e}")
            return []
    
    def remove_warning(self, warning_id):
        """Remove a warning by ID."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute("DELETE FROM warnings WHERE id = ?", (warning_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            logger.error(f"Error removing warning: {e}")
            return False
    
    # Temporary ban methods
    def add_temp_ban(self, user_id, guild_id, end_time):
        """Add a temporary ban."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute(
                "INSERT OR REPLACE INTO temp_bans (user_id, guild_id, end_time) VALUES (?, ?, ?)",
                (user_id, guild_id, end_time)
            )
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"Error adding temporary ban: {e}")
            return False
    
    def get_expired_bans(self, current_time):
        """Get all expired temporary bans."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute(
                "SELECT user_id, guild_id FROM temp_bans WHERE end_time <= ?",
                (current_time,)
            )
            return cursor.fetchall()
        except sqlite3.Error as e:
            logger.error(f"Error getting expired bans: {e}")
            return []
    
    def remove_temp_ban(self, user_id):
        """Remove a temporary ban."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute("DELETE FROM temp_bans WHERE user_id = ?", (user_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            logger.error(f"Error removing temporary ban: {e}")
            return False
    
    # Temporary mute methods
    def add_temp_mute(self, user_id, guild_id, end_time):
        """Add a temporary mute."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute(
                "INSERT OR REPLACE INTO temp_mutes (user_id, guild_id, end_time) VALUES (?, ?, ?)",
                (user_id, guild_id, end_time)
            )
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"Error adding temporary mute: {e}")
            return False
    
    def get_expired_mutes(self, current_time):
        """Get all expired temporary mutes."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute(
                "SELECT user_id, guild_id FROM temp_mutes WHERE end_time <= ?",
                (current_time,)
            )
            return cursor.fetchall()
        except sqlite3.Error as e:
            logger.error(f"Error getting expired mutes: {e}")
            return []
    
    def remove_temp_mute(self, user_id):
        """Remove a temporary mute."""
        try:
            self._ensure_connection()
            cursor = self.conn.cursor()
            
            cursor.execute("DELETE FROM temp_mutes WHERE user_id = ?", (user_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            logger.error(f"Error removing temporary mute: {e}")
            return False
    
    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None 