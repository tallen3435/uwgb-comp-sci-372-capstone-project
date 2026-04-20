import os
import random
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

        # Define the list of sender personas
        personas = [
            "HR Manager demanding immediate completion of mandatory training",
            "Company CEO or Executive requesting an urgent, confidential task",
            "IT Support warning about a compromised account or password reset",
            "External Vendor following up on an unpaid, overdue invoice",
            "Friendly coworker sharing a link to a collaborative document",
            "Automated Corporate System (e.g., Payroll, Microsoft 365, Slack alert)",
            "Recruiter from another company offering a highly lucrative job",
            "Thomas Allen (who is a coworker) asking if he wants to go out to lunch/dinner, sharing link to restaurant",
            "Newsletter from University of Wisconsin-Green Bay Computer Science program",
            "Reminder to complete mandatory education for the current year",
            "List of job offers from Handshake/LinkedIn"
        ]

        # Randomly select one persona
        selected_personas = random.choice(personas)
        company_name = "Malware Incorporated"

        # Craft the prompt for the educational simulation [cite: 68, 75]
        prompt = (
            f"Generate a {difficulty} {target_type} email for a cybersecurity training game. "
            f"The sender of this email should be acting as a: {selected_personas}. "
            f"If phishing, include realistic social engineering tactics. [cite: 131, 151]"
            f"If applicable, the company we are working for is: {company_name}"
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
    if filename.endswith('.html'):
        return render_template(filename)
    return send_from_directory('templates', filename)

# self-hosted server for debugging
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
