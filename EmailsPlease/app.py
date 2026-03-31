import os
from flask import Flask, jsonify, request
from google import genai

app = Flask(__name__)

# This is the 'handshake'. The code doesn't have the key,
# it just knows where to look for it.
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

@app.route('/api/generate', methods=['POST'])
def generate_email():
    # Your logic for calling Gemini...
    return jsonify({"message": "Email generated successfully"})