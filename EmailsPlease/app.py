import os
import random
import sqlite3
import json
from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List

# Initialize Environment and Flask
load_dotenv()  # Loads GEMINI_API_KEY from .env
app = Flask(__name__)
CORS(app)

LEADERBOARD_FILE = "leaderboard.json"

# 2. Define the Structured Data Schema
# database config
# define where the database will live
# replace with absolute path in back-end to save from deployment updates (Jenkins)
DATABASE = 'emails_please.db'

# Define the Structured Data Schema
class SimulatedEmail(BaseModel):
    sender: str
    subject: str
    body: str
    classification: str  # "legitimate" or "phishing"
    difficulty: str
    cues: List[str]

def load_leaderboard():
    if not os.path.exists(LEADERBOARD_FILE):
        return []
    with open(LEADERBOARD_FILE, "r") as f:
        return json.load(f)

def save_leaderboard(data):
    with open(LEADERBOARD_FILE, "w") as f:
        json.dump(data, f, indent=2)

# SQLite helper functions
def init_db():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
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
        conn.commit()

def get_email_from_db(target_type, difficulty):
    with sqlite3.connect(DATABASE) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM emails
            WHERE target_type = ? AND difficulty = ?
            ORDER BY RANDOM() LIMIT 1
        ''', (target_type, difficulty))

        row = cursor.fetchone()
        if row:
            return {
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
            target_type,
            email_data["difficulty"],
            email_data["sender"],
            email_data["subject"],
            email_data["body"],
            email_data["classification"],
            json.dumps(email_data["cues"])
        ))
        conn.commit()


# API route
@app.route('/api/generate-email', methods=['POST'])
def handle_email_generation():
    """
    Primary endpoint for the 'Emails Please' game to request new content.
    """
    try:
        data = request.get_json()
        target_type = data.get('type', 'phishing')
        difficulty = data.get('difficulty', 'medium')
        company_name = "Malware Incorporated"

        # --- STEP 1: CHECK THE DATABASE ---
        existing_email = get_email_from_db(target_type, difficulty)

        if existing_email:
            print(f"✅ Served a cached {target_type} email from SQLite!")
            return jsonify(existing_email), 200

        # --- STEP 2: NOT IN DB, GENERATE WITH GEMINI ---
        print(f"Generating a new unique {target_type} email via Gemini...")
        client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

        if target_type == 'phishing':
            # These personas focus on urgency, spoofing, and malicious links
            personas = [
                "HR Manager demanding immediate completion of mandatory training",
                "Company CEO requesting an urgent, confidential financial task",
                "IT Support warning about a compromised account or password reset",
                "External Vendor following up on an unpaid, overdue invoice",
                "Recruiter from another company offering a highly lucrative job",
                "Spoofed coworker (Thomas Allen) asking for lunch and sharing a suspicious link to a 'menu'",
                "Fake reminder to complete mandatory education with a 'login' link",
                "Urgent Job Offer alert from a platform like Handshake or LinkedIn"
            ]
            selected_persona = random.choice(personas)
            prompt = (
                f"Generate a {difficulty} level phishing email for a cybersecurity training game. "
                f"The sender is acting as a: {selected_persona}. "
                f"Include realistic social engineering tactics like urgency, fear, or a suspicious call to action. "
                f"The target company is: {company_name}"
            )
        else:
            # These personas focus on boring, routine, and safe communications
            personas = [
                "The real University of Wisconsin-Green Bay Computer Science program newsletter",
                "A standard automated reminder to complete yearly mandatory education",
                "A routine list of job postings from Handshake or LinkedIn (no urgency)",
                "Friendly coworker (Thomas Allen) actually asking if you want to go to lunch",
                "Automated Corporate System sending a standard payroll or Slack alert",
                "Coworker sharing a link to a collaborative document you were expecting"
            ]
            selected_persona = random.choice(personas)
            prompt = (
                f"Generate a {difficulty} level legitimate corporate email for a training simulation. "
                f"The sender is: {selected_persona}. "
                f"CRITICAL: This email must be mundane and safe. Do not include threats, urgency, or suspicious links. "
                f"The company name is: {company_name}"
            )

        # Call the Gemini API with structured output
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config={
                "temperature": 0.85,  # ensures wider variety of email generation types
                "response_mime_type": "application/json",
                "response_schema": SimulatedEmail,
                "safety_settings": [
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
                ]
            }
        )

        new_email = response.parsed.dict()

        # --- STEP 3: SAVE TO DB ---
        save_email_to_db(target_type, new_email)

        return jsonify(new_email), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/submit-score', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        username = data.get('username', 'Anonymous')[:20]
        score = int(data.get('score', 0))

        board = load_leaderboard()

        # Check if user already exists
        existing = next((e for e in board if e["username"] == username), None)

        if existing:
            existing["score"] = max(existing["score"], score)
        else:
            board.append({
                "username": username,
                "score": score
            })

        # Sort and keep top 10
        board = sorted(board, key=lambda x: x["score"], reverse=True)[:10]

        save_leaderboard(board)

        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        return jsonify(load_leaderboard()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/", methods=['GET'])
def index():
    return render_template("index.html")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "online",
        "project": "Emails Please API",
        "message": "Send a POST request to /api/generate-email to use the generator."
    }), 200

@app.route('/resources/<path:filename>')
def serve_resource(filename):
    return send_from_directory('resources', filename)

@app.route('/<path:filename>')
def serve_template(filename):
    if filename.endswith('.html'):
        return render_template(filename)
    return send_from_directory('templates', filename)

# self-hosted server for debugging
if __name__ == '__main__':
    # Initialize the database table before the server boots up
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
