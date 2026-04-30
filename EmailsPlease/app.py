import os
import json
import random
import time
import threading
from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List

# Import database.py file
import database as db

# Initialize Environment and Flask
if os.path.exists('/IMPORTANT/.env'):
    load_dotenv('/IMPORTANT/.env')  # Live server
else:
    load_dotenv()                   # Local development fallback

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

#Global AI Client
gemini_client = None
api_lock = threading.Lock()

def get_gemini_client():
    global gemini_client
    if gemini_client is None:
        gemini_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'), http_options={'timeout': 45000})
    return gemini_client


# Define the Structured Data Schema for Gemini
class SimulatedEmail(BaseModel):
    sender: str
    subject: str
    body: str
    classification: str
    difficulty: str
    cues: List[str]


def get_fallback_email(target_type, difficulty):
    templates_path = os.path.join(os.path.dirname(__file__), 'resources', 'templates', 'emailTemplates.json')
    with open(templates_path, 'r') as f:
        data = json.load(f)

    lookup_type = 'phish' if target_type == 'phishing' else 'legit'
    matching = [e for e in data['emails'] if e['type'] == lookup_type and e['difficulty'] == difficulty]
    if not matching:
        matching = [e for e in data['emails'] if e['type'] == lookup_type]
    if not matching:
        matching = data['emails']

    chosen = random.choice(matching)
    return {
        'id': chosen['id'],
        'sender': f"{chosen['from']} <{chosen['address']}>",
        'subject': chosen['subject'],
        'body': chosen['body'],
        'classification': 'phishing' if chosen['type'] == 'phish' else 'legitimate',
        'difficulty': chosen['difficulty'],
        'cues': chosen.get('redFlags', [])
    }


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
            existing_email['is_cached'] = True
            return jsonify(existing_email), 200

        # --- STEP 2: NOT IN DB (OR ALL SEEN), GENERATE WITH GEMINI ---
        print(f"🤖 Generating new {target_type} email. User has exhausted cached pool...")
        try:
            client = get_gemini_client()
        except Exception as e:
            print(f"⚠️ Gemini API failed to initialize (missing API key?): {e}")
            return jsonify(get_fallback_email(target_type, difficulty)), 200

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
                "Urgent Job Offer alert from a platform like Handshake or LinkedIn",
                "Elon Musk offering you a free Tesla",
                "Bill Gates offering a large amount of money from his foundation",
                "A Nigerian prince offering you his gold stash in exchange for your PayPal",
                "Calvin shares a suspicious new AI for you to try out",
                "Doordash failing to verify your phone number and/or address with a suspicious link",
                "Microsoft demanding immediate action for suspended account",
                "'rnalware Inc' asks for your employee ID for verification",
                "Fake vacation offer using broken english and a suspicious link",
                "Spoofed employee asking the passcode to get into the corporate building",
                "You win the lottery (over 1 billion dollars) but its not real",
                "Unknown sender exclaiming that its the end of the world and demanding money",
                "PayPal message stating that someone mistakenly sent you some amount of money",
                "Fake charity asking you to donate money",
                "Spoofed coworker (Bryon Cobb) asking you for confidential information",
                "Window cleaning service urgently reminding you about their scheduled service",
                "Free gift card giveaway from a spoofed youtube.com",
                "Fake survey from Apple offering free gift cards as reward for filling out survey",
                "Fake system message stating urgency of critical systems down (ransomware)"
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
                "Coworker sharing a link to a collaborative document you were expecting",
                "Internal Malware Incorporated volunteer opportunities",
                "A coworker asking for your suggestions for a legitimate project",
                "Real message from IT following up on submitted ticket",
                "Friendly coworker (Grafton Smith) asking if you want to go out for coffe tomorrow morning"
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
        max_retries = 5
        new_email = None

        # Lock the generation to ensure multiple concurrent Flask threads don't bypass the rate limit
        with api_lock:
            # PROACTIVE RATE LIMITING
            # Sleeping for 3 seconds guarantees requests are spaced apart safely globally
            time.sleep(3)

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

                    # Safely handle both Pydantic v1 (dict) and v2 (model_dump) that Google SDKs use
                    new_email = response.parsed.model_dump() if hasattr(response.parsed, 'model_dump') else response.parsed.dict()
                    break  # If it succeeds, break out of the retry loop!

                except Exception as api_error:
                    # Retry on ANY API error (rate limits, quotas, or unparsed JSON)
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Waits 1s, then 2s, then gives up
                        print(f"⚠️ Gemini API Error (Attempt {attempt + 1}): {api_error}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        print(f"⚠️ All Gemini retries exhausted due to: {api_error}")
                        # Do NOT crash. Break the loop so the static fallback emails are served smoothly!
                        break

        if not new_email:
            print("⚠️ All Gemini retries failed. Serving static fallback email.")
            return jsonify(get_fallback_email(target_type, difficulty)), 200

        # --- STEP 3: SAVE TO DB AND LINK TO USER ---
        # 🎯 FIX: Override the AI's output to strictly match the requested variables. 
        # This stops AI capitalization or hallucinations (e.g., "Medium level") from breaking the DB cache.
        new_email['classification'] = target_type
        new_email['difficulty'] = difficulty

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
