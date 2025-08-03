import os
import json
import base64
import asyncio
import uvicorn
import tempfile
import google.generativeai as genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import speech_recognition as sr
from gtts import gTTS
import io
import wave
from pydub import AudioSegment

# Load environment variables
load_dotenv()

PORT = int(os.getenv("PORT", "3001"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GEMINI_API_KEY and not GOOGLE_API_KEY:
    raise ValueError("Either GEMINI_API_KEY or GOOGLE_API_KEY must be set.")

# Use whichever API key is available
api_key = GOOGLE_API_KEY or GEMINI_API_KEY

WS_URL = f"ws://localhost:{PORT}/ws"
WELCOME_GREETING = "Hi! I am Rev, your voice assistant powered by Gemini. Ask me anything!"

SYSTEM_PROMPT = """
You are Rev, a helpful and friendly voice assistant. This conversation is happening over a website called Revolt, so your responses will be spoken aloud.
Please adhere to the following rules:
1. Provide clear, concise, and direct answers.
2. Spell out all numbers (e.g., say 'one thousand two hundred' instead of 1200).
3. Do not use any special characters like asterisks, bullet points, or emojis.
4. Keep the conversation natural and engaging.
5. Keep responses relatively short and conversational (1-3 sentences typically).
6. You can introduce yourself as Rev when appropriate.
"""

# Configure Gemini
genai.configure(api_key=api_key)
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",
    system_instruction=SYSTEM_PROMPT
)

# Store active sessions
sessions = {}
recognizer = sr.Recognizer()
recognizer.energy_threshold = 300
recognizer.dynamic_energy_threshold = True
recognizer.pause_threshold = 0.8

app = FastAPI()

# Add CORS middleware for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def base64_to_wav_file(base64_audio):
    """Convert base64 audio to WAV file"""
    try:
        # Decode base64 audio
        audio_data = base64.b64decode(base64_audio)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_file.write(audio_data)
        temp_file.close()
        
        return temp_file.name
    except Exception as e:
        print(f"Error converting base64 to audio file: {e}")
        return None

def transcribe_audio(audio_file_path):
    """Transcribe audio file to text using Google Speech Recognition"""
    try:
        # First, try to load the audio file with pydub and convert if necessary
        try:
            audio = AudioSegment.from_file(audio_file_path)
            # Convert to wav format if it's not already
            if not audio_file_path.endswith('.wav'):
                wav_path = audio_file_path.replace(audio_file_path.split('.')[-1], 'wav')
                audio.export(wav_path, format="wav")
                audio_file_path = wav_path
        except Exception as e:
            print(f"Audio conversion warning: {e}")
        
        # Use speech recognition
        with sr.AudioFile(audio_file_path) as source:
            # Adjust for ambient noise
            recognizer.adjust_for_ambient_noise(source, duration=0.2)
            audio_data = recognizer.record(source)
            
        # Use Google Speech Recognition
        text = recognizer.recognize_google(audio_data)
        print(f"Transcribed: {text}")
        return text
        
    except sr.UnknownValueError:
        print("Could not understand audio")
        return "Sorry, I couldn't understand what you said. Could you please repeat that?"
    except sr.RequestError as e:
        print(f"Error with speech recognition service: {e}")
        return "Sorry, there was an error with the speech recognition service."
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return "Sorry, there was an error processing your audio."

def text_to_speech(text):
    """Convert text to speech and return as base64 PCM data"""
    try:
        # Create TTS audio using gTTS
        tts = gTTS(text=text, lang='en', slow=False)
        
        # Save to temporary MP3 file
        temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        tts.save(temp_mp3.name)
        
        # Convert MP3 to WAV using pydub
        audio = AudioSegment.from_mp3(temp_mp3.name)
        
        # Convert to mono, 24kHz, 16-bit (to match frontend expectations)
        audio = audio.set_channels(1).set_frame_rate(24000).set_sample_width(2)
        
        # Get raw PCM data
        pcm_data = audio.raw_data
        
        # Convert to base64
        base64_audio = base64.b64encode(pcm_data).decode('utf-8')
        
        # Clean up temporary files
        os.unlink(temp_mp3.name)
        
        return base64_audio
        
    except Exception as e:
        print(f"Error converting text to speech: {e}")
        # Return a simple error message as base64 audio if TTS fails
        return None

async def gemini_response(chat_session, user_prompt):
    """Get response from Gemini"""
    try:
        response = await chat_session.send_message_async(user_prompt)
        return response.text
    except Exception as e:
        print(f"Error getting Gemini response: {e}")
        return "Sorry, I encountered an error while processing your request. Please try again."

@app.get("/")
async def root():
    return {
        "message": "Rev Voice Assistant Backend Running", 
        "ws_url": WS_URL,
        "status": "healthy"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "sessions": len(sessions),
        "port": PORT
    }

@app.post("/session")
async def session_endpoint():
    return JSONResponse(content={
        "ws_url": WS_URL,
        "welcome_message": WELCOME_GREETING,
        "voice_id": "default",
        "tts_provider": "Google"
    })

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    print(f"🔌 New WebSocket connection: {session_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "start_session":
                # Initialize Gemini chat session
                sessions[session_id] = model.start_chat(history=[])
                print(f"✅ Started session: {session_id}")
                await websocket.send_text(json.dumps({"type": "session_started"}))
                
            elif message["type"] == "send_audio":
                print(f"🎤 Received audio from session: {session_id}")
                
                # Get base64 audio data
                base64_audio = message.get("audio", "")
                
                if not base64_audio:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "No audio data received"
                    }))
                    continue
                
                # Convert base64 to audio file
                audio_file_path = base64_to_wav_file(base64_audio)
                
                if not audio_file_path:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Failed to process audio data"
                    }))
                    continue
                
                try:
                    # Transcribe audio to text
                    user_prompt = transcribe_audio(audio_file_path)
                    print(f"👤 User said: {user_prompt}")
                    
                    # Get chat session
                    chat_session = sessions.get(session_id)
                    if not chat_session:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Session not found"
                        }))
                        continue
                    
                    # Get response from Gemini
                    response_text = await gemini_response(chat_session, user_prompt)
                    print(f"🤖 Rev responds: {response_text}")
                    
                    # Convert response to speech
                    audio_response = text_to_speech(response_text)
                    
                    if audio_response:
                        # Send audio response
                        await websocket.send_text(json.dumps({
                            "type": "audio_response",
                            "audio": audio_response
                        }))
                        print("🔊 Audio response sent")
                    else:
                        # Fallback: send text response if TTS fails
                        await websocket.send_text(json.dumps({
                            "type": "text_response",
                            "text": response_text
                        }))
                        print("📝 Text response sent (TTS failed)")
                    
                    # Signal turn complete
                    await websocket.send_text(json.dumps({"type": "turn_complete"}))
                    
                finally:
                    # Clean up temporary audio file
                    if audio_file_path and os.path.exists(audio_file_path):
                        os.unlink(audio_file_path)
                
            elif message["type"] == "interrupt":
                print(f"⏹️ Interrupted session {session_id}")
                await websocket.send_text(json.dumps({"type": "turn_complete"}))
                
            else:
                print(f"❓ Unknown message type: {message['type']}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Unknown message type: {message['type']}"
                }))
                
    except WebSocketDisconnect:
        print(f"🔌 WebSocket connection closed for session {session_id}")
    except Exception as e:
        print(f"❌ Error in WebSocket connection {session_id}: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "An unexpected error occurred"
            }))
        except:
            pass
    finally:
        # Clean up session
        if session_id in sessions:
            sessions.pop(session_id)
            print(f"🧹 Cleared session for {session_id}")

if __name__ == "__main__":
    print("🚀 Starting Rev Voice Assistant Backend")
    print(f"📡 Server will run on: http://localhost:{PORT}")
    print(f"🔌 WebSocket URL: {WS_URL}")
    print(f"🔑 Using API key: {'✅ Set' if api_key else '❌ Not set'}")
    print("\n" + "="*50)
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=PORT,
        log_level="info"
    )