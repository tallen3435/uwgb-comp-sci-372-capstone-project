import os
from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List

# 1. Initialize Environment and Flask
load_dotenv()  # Loads GEMINI_API_KEY from .env
app = Flask(__name__, static_folder=None)
CORS(app)

# 2. Define the Structured Data Schema
class SimulatedEmail(BaseModel):
    sender: str
    subject: str
    body: str
    classification: str  # "legitimate" or "phishing"
    difficulty: str
    cues: List[str]

@app.route("/", methods=['GET'])
def index():
    return render_template("index.html")

@app.route("/gameScreen")
def game_screen():
    return render_template("gameScreen.html")

@app.route("/aboutUs")
def about_us():
    return render_template("aboutUs.html")

@app.route("/crashCourse")
def crash_course():
    return render_template("crashCourse.html")

@app.route("/gameOver")
def game_over():
    return render_template("gameOver.html")

@app.route("/legal")
def legal():
    return render_template("legal.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")

@app.route("/tutorial")
def tutorial():
    return render_template("tutorial.html")

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
    return send_from_directory('templates', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
