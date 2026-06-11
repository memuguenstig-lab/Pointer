import json
import os
import logging

logger = logging.getLogger('shadowide_bot')

class Database:
    @staticmethod
    def load_data(file_path):
        """Load data from a JSON file"""
        try:
            if not os.path.exists(file_path):
                # If file doesn't exist, create it with empty data
                with open(file_path, 'w') as f:
                    json.dump({}, f)
                return {}
            
            with open(file_path, 'r') as f:
                data = json.load(f)
                return data
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            # Try to backup and recreate the file
            try:
                backup_path = f"{file_path}.backup"
                if os.path.exists(file_path):
                    os.rename(file_path, backup_path)
                with open(file_path, 'w') as f:
                    json.dump({}, f)
                logger.info(f"Recreated {file_path} due to corruption")
            except Exception as backup_error:
                logger.error(f"Failed to backup and recreate {file_path}: {backup_error}")
            return {}
        except Exception as e:
            logger.error(f"Error loading data from {file_path}: {e}")
            return {}
    
    @staticmethod
    def save_data(file_path, data):
        """Save data to a JSON file"""
        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=4)
            return True
        except Exception as e:
            logger.error(f"Error saving data to {file_path}: {e}")
            return False
    
    # Economy functions
    @staticmethod
    def get_user_balance(user_id):
        """Get a user's balance"""
        economy_data = Database.load_data("data/economy.json")
        user_id = str(user_id)  # Convert to string to use as JSON key
        
        if user_id not in economy_data:
            # Initialize user if not exists
            economy_data[user_id] = {"balance": 0}
            Database.save_data("data/economy.json", economy_data)
            
        return economy_data[user_id]["balance"]
    
    @staticmethod
    def update_user_balance(user_id, amount, operation="add"):
        """Update a user's balance
        
        Parameters:
        -----------
        user_id : int or str
            The user's ID
        amount : int
            The amount to add or set
        operation : str
            The operation to perform ('add', 'subtract', 'set')
        
        Returns:
        --------
        int
            The new balance
        """
        economy_data = Database.load_data("data/economy.json")
        user_id = str(user_id)  # Convert to string to use as JSON key
        
        # Initialize user if not exists
        if user_id not in economy_data:
            economy_data[user_id] = {"balance": 0}
        
        # Perform operation
        if operation == "add":
            economy_data[user_id]["balance"] += amount
        elif operation == "subtract":
            economy_data[user_id]["balance"] -= amount
            # Ensure balance doesn't go negative
            if economy_data[user_id]["balance"] < 0:
                economy_data[user_id]["balance"] = 0
        elif operation == "set":
            economy_data[user_id]["balance"] = amount
        
        # Save updated data
        Database.save_data("data/economy.json", economy_data)
        
        return economy_data[user_id]["balance"]
    
    # Leveling functions
    @staticmethod
    def get_user_level_data(user_id):
        """Get a user's level data"""
        level_data = Database.load_data("data/levels.json")
        user_id = str(user_id)
        
        if user_id not in level_data:
            level_data[user_id] = {"xp": 0, "level": 0, "last_message_time": 0, "messages": 0}
            Database.save_data("data/levels.json", level_data)
            
        return level_data[user_id]
    
    @staticmethod
    def update_user_message_count(user_id, guild_id=None):
        """Update a user's message count"""
        level_data = Database.load_data("data/levels.json")
        user_id = str(user_id)
        
        if user_id not in level_data:
            level_data[user_id] = {"xp": 0, "level": 0, "last_message_time": 0, "messages": 0}
        
        # Increment message count
        level_data[user_id]["messages"] = level_data[user_id].get("messages", 0) + 1
        
        # Store guild ID if provided
        if guild_id:
            level_data[user_id]["guild_id"] = guild_id
        
        Database.save_data("data/levels.json", level_data)
        return level_data[user_id]["messages"]
    
    @staticmethod
    def get_user_message_count(user_id):
        """Get a user's message count"""
        level_data = Database.load_data("data/levels.json")
        user_id = str(user_id)
        
        if user_id not in level_data:
            return 0
            
        return level_data[user_id].get("messages", 0)
    
    @staticmethod
    def update_user_xp(user_id, xp_to_add, current_time):
        """Update a user's XP and potentially level up"""
        level_data = Database.load_data("data/levels.json")
        user_id = str(user_id)
        
        if user_id not in level_data:
            level_data[user_id] = {"xp": 0, "level": 0, "last_message_time": 0}
            
        # Add XP
        level_data[user_id]["xp"] += xp_to_add
        level_data[user_id]["last_message_time"] = current_time
        
        # Calculate level using the proper formula
        from utils.helpers import calculate_level_for_xp
        old_level = level_data[user_id]["level"]
        new_level = calculate_level_for_xp(level_data[user_id]["xp"])
        
        level_data[user_id]["level"] = new_level
        Database.save_data("data/levels.json", level_data)
        
        # Return whether user leveled up
        if new_level > old_level:
            return new_level
        return None
    
    # Jobs functions
    @staticmethod
    def get_all_jobs():
        """Get all available jobs"""
        jobs_data = Database.load_data("data/jobs.json")
        return jobs_data.get("jobs", [])
    
    @staticmethod
    def get_user_job(user_id):
        """Get a user's current job"""
        jobs_data = Database.load_data("data/jobs.json")
        user_id = str(user_id)
        
        if "user_jobs" not in jobs_data:
            jobs_data["user_jobs"] = {}
            
        return jobs_data["user_jobs"].get(user_id, None)
    
    @staticmethod
    def set_user_job(user_id, job_id, start_time):
        """Set a user's job"""
        jobs_data = Database.load_data("data/jobs.json")
        user_id = str(user_id)
        
        if "user_jobs" not in jobs_data:
            jobs_data["user_jobs"] = {}
            
        # Find job data
        job_data = None
        for job in jobs_data.get("jobs", []):
            if job["id"] == job_id:
                job_data = job
                break
                
        if not job_data:
            return False
            
        jobs_data["user_jobs"][user_id] = {
            "job_id": job_id,
            "start_time": start_time,
            "last_paid_time": start_time
        }
        
        Database.save_data("data/jobs.json", jobs_data)
        return True
    
    @staticmethod
    def remove_user_job(user_id):
        """Remove a user's job"""
        jobs_data = Database.load_data("data/jobs.json")
        user_id = str(user_id)
        
        if "user_jobs" not in jobs_data or user_id not in jobs_data["user_jobs"]:
            return False
            
        del jobs_data["user_jobs"][user_id]
        Database.save_data("data/jobs.json", jobs_data)
        return True
    
    @staticmethod
    def update_user_job_payment(user_id, new_last_paid_time):
        """Update a user's last paid time for their job"""
        jobs_data = Database.load_data("data/jobs.json")
        user_id = str(user_id)
        
        if "user_jobs" not in jobs_data or user_id not in jobs_data["user_jobs"]:
            return False
            
        jobs_data["user_jobs"][user_id]["last_paid_time"] = new_last_paid_time
        Database.save_data("data/jobs.json", jobs_data)
        return True
        
    # Giveaway functions
    @staticmethod
    def save_giveaway(giveaway_data):
        """Save a giveaway to the database"""
        giveaways = Database.load_data("data/giveaways.json")
        giveaways.append(giveaway_data)
        Database.save_data("data/giveaways.json", giveaways)
        
    @staticmethod
    def get_active_giveaways():
        """Get all active giveaways"""
        giveaways = Database.load_data("data/giveaways.json")
        return [g for g in giveaways if not g.get("ended", False)]
        
    @staticmethod
    def update_giveaway(message_id, updated_data):
        """Update a giveaway's data"""
        giveaways = Database.load_data("data/giveaways.json")
        
        for i, giveaway in enumerate(giveaways):
            if giveaway.get("message_id") == message_id:
                giveaways[i].update(updated_data)
                Database.save_data("data/giveaways.json", giveaways)
                return True
                
        return False 