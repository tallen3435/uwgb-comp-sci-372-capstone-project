import sqlite3
import pandas as pd
"""
NOTE: This file is for debugging purposes only
"""
# Connect to your local database
conn = sqlite3.connect('emails_please.db')

print("--- ALL GENERATED EMAILS ---")
# Using pandas makes the terminal output format into a beautiful table automatically
emails_df = pd.read_sql_query("SELECT id, target_type, difficulty, sender FROM emails", conn)
print(emails_df)

print("\n--- USER SEEN EMAILS (JUNCTION TABLE) ---")
seen_df = pd.read_sql_query("SELECT * FROM user_seen_emails", conn)
print(seen_df)

conn.close()