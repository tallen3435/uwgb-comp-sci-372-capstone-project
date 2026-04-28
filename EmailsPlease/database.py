import os
import sqlite3
import json
import platform

LEADERBOARD_FILE = "leaderboard.json"

# --- Database Configuration ---
if platform.system() == 'Windows' or platform.system() == 'Darwin': # Darwin is macOS
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    DATABASE = os.path.join(BASE_DIR, 'emails_please.db')
else: # Linux (Ubuntu/Debian-based)
    DATABASE = '/opt/emails_please_data/emails_please.db'


def init_db():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()

        # 1. Core emails table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_type TEXT,
                difficulty TEXT,
                sender TEXT,
                subject TEXT,
                body TEXT,
                classification TEXT,
                cues TEXT
            )
        ''')

        # 2. Junction table to track what users have seen
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_seen_emails (
                user_id TEXT,
                email_id INTEGER,
                FOREIGN KEY(email_id) REFERENCES emails(id),
                PRIMARY KEY (user_id, email_id)
            )
        ''')
        conn.commit()


# Run initialization immediately when this module is imported
init_db()


def mark_email_as_seen(user_id, email_id):
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO user_seen_emails (user_id, email_id)
            VALUES (?, ?)
        ''', (user_id, email_id))
        conn.commit()


def get_unseen_email_from_db(target_type, difficulty, user_id):
    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # We wrap the columns and the ? variables in LOWER()
        # so "Hard", "HARD", and "hard" all match perfectly.
        cursor.execute('''
            SELECT * FROM emails
            WHERE LOWER(target_type) = LOWER(?) AND LOWER(difficulty) = LOWER(?)
            AND id NOT IN (
                SELECT email_id FROM user_seen_emails WHERE user_id = ?
            )
            ORDER BY RANDOM() LIMIT 1
        ''', (target_type, difficulty, user_id))

        row = cursor.fetchone()
        if row:
            mark_email_as_seen(user_id, row["id"])
            return {
                "id": row["id"],
                "sender": row["sender"],
                "subject": row["subject"],
                "body": row["body"],
                "classification": row["classification"],
                "difficulty": row["difficulty"],
                "cues": json.loads(row["cues"])
            }
        return None


def save_email_to_db(target_type, email_data):
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO emails (target_type, difficulty, sender, subject, body, classification, cues)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            target_type.lower(),            # <--- Force lowercase
            email_data["difficulty"].lower(), # <--- Force lowercase
            email_data["sender"],
            email_data["subject"],
            email_data["body"],
            email_data["classification"],
            json.dumps(email_data["cues"])
        ))
        conn.commit()
        return cursor.lastrowid


# --- Leaderboard Functions ---
def load_leaderboard():
    if not os.path.exists(LEADERBOARD_FILE):
        return []
    with open(LEADERBOARD_FILE, "r") as f:
        return json.load(f)


def save_leaderboard(data):
    with open(LEADERBOARD_FILE, "w") as f:
        json.dump(data, f, indent=2)