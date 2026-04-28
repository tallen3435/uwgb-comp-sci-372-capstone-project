import os
import sqlite3
import json
import platform
import secrets
from datetime import datetime, timedelta

LEADERBOARD_FILE = "leaderboard.json"

# --- Database Configuration ---
if platform.system() == 'Windows' or platform.system() == 'Darwin': # Darwin is macOS
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    DATABASE = os.path.join(BASE_DIR, 'emails_please.db')
else: # Linux (Ubuntu/Debian-based)
    DATABASE = '/opt/emails_please_data/emails_please.db'


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS session (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_state (
            user_id INTEGER PRIMARY KEY,
            highscore INTEGER DEFAULT 0,
            current_score INTEGER DEFAULT 0,
            day INTEGER DEFAULT 1,
            game_current NUMERIC DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT,
            difficulty TEXT,
            sender TEXT,
            subject TEXT,
            body TEXT,
            classification TEXT,
            cues TEXT
        );

        CREATE TABLE IF NOT EXISTS user_seen_emails (
            user_id INTEGER,
            email_id INTEGER,
            PRIMARY KEY (user_id, email_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE  
        );
        ''')
        conn.commit()


# Run initialization immediately when this module is imported
init_db()


def mark_email_as_seen(user_id, email_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO user_seen_emails (user_id, email_id)
            VALUES (?, ?)
        ''', (user_id, email_id))
        conn.commit()


def get_unseen_email_from_db(target_type, difficulty, user_id):
    with get_db_connection() as conn:
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
    with get_db_connection() as conn:
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


def generate_token():
    return secrets.token_hex(16)


def login(username, password):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        clean_session_table()
        cursor.execute("SELECT id FROM users WHERE username=? AND password=?", (username, password))
        user = cursor.fetchone()

        if user is not None:
            token = generate_token()
            # Formatted the date as a string for the TEXT column
            expiry = (datetime.now() + timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')

            # user[0] gets the ID from the tuple
            cursor.execute("INSERT INTO session (user_id, token, expires_at) VALUES (?, ?, ?);", (user[0], token, expiry))
            conn.commit()
            return token
        return -1


def check_session(token):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, id, expires_at FROM session WHERE token=?", (token,))
        conn.commit()
        row = cursor.fetchone()

        if row:
            expiry_date = datetime.strptime(row[2], '%Y-%m-%d %H:%M:%S')
            if expiry_date > datetime.now():
                user_id = row[0]
                new_expiry = (datetime.now() + timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute("UPDATE session SET expires_at = ? WHERE id = ?", (new_expiry, row[1]))
                conn.commit()
                return user_id
        return -1


def create_user(username, password):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username=?", (username,))
        if cursor.fetchone() is None:
            # Fixed typo 'passsword' to 'password'
            cursor.execute("INSERT INTO users (username, password) VALUES (?, ?);", (username, password))

            # Use lastrowid to get the new user's ID instantly
            new_user_id = cursor.lastrowid
            cursor.execute("INSERT INTO user_state (user_id) VALUES (?)", (new_user_id,))

            conn.commit()
            return 1
        return -1
def change_password(token, new_password):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        user_id=check_session(token)
        if(user_id == -1):
            return False
        else:
            cursor.execute("UPDATE users SET password=? WHERE id=?", (new_password, user_id))
            conn.commit()
            return True
def clean_session_table():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM session where expires_at < ?", (datetime.now()))
        conn.commit()