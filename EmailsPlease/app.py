import os
import json
from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List

# 1. Initialize Environment and Flask
load_dotenv()  # Loads GEMINI_API_KEY from .env
app = Flask(__name__)
CORS(app)

LEADERBOARD_FILE = "leaderboard.json"

# 2. Define the Structured Data Schema
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

@app.route("/", methods=['GET'])
def index():
    return render_template("index.html")



@app.route('/api/generate-email', methods=['POST'])
def handle_email_generation():
    """
    Primary endpoint for the 'Emails Please' game to request new content. [cite: 2, 31]
    """
    try:
        # 3. Initialize the Gemini Client (lazy — so server starts without a key)
        client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

        # Get user preferences from the front-end request
        data = request.get_json()
        target_type = data.get('type', 'phishing')  # Default to phishing for training
        difficulty = data.get('difficulty', 'medium')

        # Craft the prompt for the educational simulation [cite: 68, 75]
        prompt = (
            f"Generate a {difficulty} {target_type} email for a cybersecurity training game. "
            f"If phishing, include realistic social engineering tactics. [cite: 131, 151]"
        )

        # Call the Gemini API with structured output and safety overrides
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": SimulatedEmail,
                # Essential: allows generation of simulated 'dangerous' content
                "safety_settings": [
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
                ]
            }
        )


        return jsonify(response.parsed.dict()), 200

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
    app.run(host='0.0.0.0', port=5000, debug=True)
