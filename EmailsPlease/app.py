import os
import random
import time
from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List

# Import database.py file
import database as db

# Initialize Environment and Flask
load_dotenv()  # Loads GEMINI_API_KEY from .env
app = Flask(__name__)
CORS(app)


# Define the Structured Data Schema for Gemini
class SimulatedEmail(BaseModel):
    sender: str
    subject: str
    body: str
    classification: str
    difficulty: str
    cues: List[str]


# --- API Routes ---
@app.route('/api/generate-email', methods=['POST'])
def handle_email_generation():
    """
    Primary endpoint for the 'Emails Please' game to request new content.
    """
    try:
        data = request.get_json()

        target_type = data.get('type', 'phishing').lower()
        difficulty = data.get('difficulty', 'medium').lower()
        user_id = data.get('user_id', 'guest_user')
        company_name = "Malware Incorporated"

        # --- STEP 1: CHECK THE DATABASE FOR UNSEEN EMAILS ---
        existing_email = db.get_unseen_email_from_db(target_type, difficulty, user_id)

        if existing_email:
            print(f"✅ Served a cached, unseen {target_type} email for user {user_id}!")
            return jsonify(existing_email), 200

        # --- STEP 2: NOT IN DB (OR ALL SEEN), GENERATE WITH GEMINI ---
        print(f"🤖 Generating new {target_type} email. User has exhausted cached pool...")
        client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

        if target_type == 'phishing':
            ai_temperature = 0.85
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
            ai_temperature = 0.3
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
                f"CRITICAL: This email must be mundane and safe. Do not include threats, urgency, or suspicious links (no http). "
                f"no need to mention anything being safe as this is implied."
                f"The company name is: {company_name}"
            )

        # Call the Gemini API with Retry Logic
        max_retries = 3
        new_email = None

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model="gemini-3.1-flash-lite-preview",
                    contents=prompt,
                    config={
                        "temperature": ai_temperature,
                        "response_mime_type": "application/json",
                        "response_schema": SimulatedEmail,
                        "safety_settings": [
                            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
                        ]
                    }
                )

                new_email = response.parsed.dict()
                break  # If it succeeds, break out of the retry loop!

            except Exception as api_error:
                error_str = str(api_error)
                # Check if it's a server busy (503) or rate limit (429) error
                if "503" in error_str or "429" in error_str:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Waits 1s, then 2s, then gives up
                        print(f"⚠️ Gemini API busy. Retrying in {wait_time} seconds...")
                        time.sleep(wait_time)
                    else:
                        raise Exception("Gemini API is currently overloaded. Please try again in a few minutes.")
                else:
                    # If it's a different error (like a bad API key), crash immediately
                    raise api_error

        if not new_email:
            raise Exception("Failed to generate email content.")

        # --- STEP 3: SAVE TO DB AND LINK TO USER ---
        # Get the ID of the newly generated email
        new_email_id = db.save_email_to_db(target_type, new_email)

        # Link it to the user so they don't see this new one again
        db.mark_email_as_seen(user_id, new_email_id)

        # Inject the ID into the payload so the frontend has it
        new_email['id'] = new_email_id

        return jsonify(new_email), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/submit-score', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        username = data.get('username', 'Anonymous')[:20]
        score = int(data.get('score', 0))

        board = db.load_leaderboard()

        existing = next((e for e in board if e["username"] == username), None)

        if existing:
            existing["score"] = max(existing["score"], score)
        else:
            board.append({"username": username, "score": score})

        board = sorted(board, key=lambda x: x["score"], reverse=True)[:10]
        db.save_leaderboard(board)

        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        return jsonify(db.load_leaderboard()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Frontend Serving Routes ---
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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)