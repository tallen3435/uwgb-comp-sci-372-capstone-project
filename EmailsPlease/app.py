import os
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List

# 1. Initialize Environment and Flask
load_dotenv()  # Loads GEMINI_API_KEY from the .env file on the EC2 instance
app = Flask(__name__)
CORS(app)  # Allows your front-end to communicate with the AWS backend

# 2. Define the Structured Data Schema
class SimulatedEmail(BaseModel):
    sender: str
    subject: str
    body: str
    classification: str  # "legitimate" or "phishing"
    difficulty: str
    cues: List[str]

# 3. Initialize the Gemini Client
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

@app.route('/api/generate-email', methods=['POST'])
def handle_email_generation():
    """
    Primary endpoint for the 'Emails Please' game to request new content. [cite: 2, 31]
    """
    try:
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


        # Return the structured JSON to the front-end game logic [cite: 107]
        return jsonify(response.parsed.dict()), 200

    except Exception as e:
        # Basic error handling for the Software Engineering course project
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "online",
        "project": "Emails Please API",
        "message": "Send a POST request to /api/generate-email to use the generator."
    }), 200


    
if __name__ == '__main__':
    # Run the server (Joel will likely use Gunicorn for the actual EC2 deployment)
    app.run(host='0.0.0.0', port=5000)
