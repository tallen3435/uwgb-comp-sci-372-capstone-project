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
    Primary endpoint for the 'Emails Please' game to request new content.
    """
    try:
        # Initialize the Gemini Client
        client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

        data = request.get_json()
        target_type = data.get('type', 'phishing')
        difficulty = data.get('difficulty', 'medium')
        company_name = "Malware Incorporated"

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
                "response_mime_type": "application/json",
                "response_schema": SimulatedEmail,
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
