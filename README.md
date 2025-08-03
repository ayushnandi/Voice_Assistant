# Voice Assistant for Revolt Motors

A real-time voice interaction system that allows users to have natural conversations with an AI assistant about electric motorcycles. Built with React frontend and Python FastAPI backend.

## Features

- 🎤 **Real-time Voice Interaction** - Speak naturally with the AI assistant
- 🤖 **AI-Powered Responses** - Powered by Google Gemini AI
- 🔊 **Speech Recognition** - Converts speech to text using browser APIs
- 🎵 **Text-to-Speech** - Converts AI responses to spoken audio
- 🔍 **Voice Activity Detection** - Automatically detects when user is speaking
- 🎨 **Beautiful UI** - Modern, responsive design with animations
- 🌙 **Dark/Light Theme** - Toggle between themes
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Technology Stack

### Frontend
- React 19 with Vite
- Tailwind CSS for styling
- Lucide React for icons
- WebSocket for real-time communication
- Web Speech API for voice recognition

### Backend
- Python FastAPI
- Google Generative AI (Gemini)
- Speech Recognition
- Text-to-Speech
- WebSocket server

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voice_assistant
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   pip install -r requirements.txt
   cd ..
   ```

4. **Configure environment variables**
   Create `server/.env` file:
   ```env
   PORT=3001
   NODE_ENV=development
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_API_KEY=your_google_api_key_here
   ```

5. **Start the application**
   ```bash
   npm run start
   ```

### Manual Start

**Start both servers together:**
```bash
npm run start
```

**Start servers separately:**
```bash
# Terminal 1 - Backend
cd server
python main.py

# Terminal 2 - Frontend
npm run dev
```

## Usage

1. **Open Browser**: Navigate to http://localhost:3000
2. **Allow Microphone**: Grant microphone permissions when prompted
3. **Click Microphone**: Start voice interaction
4. **Speak**: Ask questions about Revolt Motors
5. **Listen**: AI responds with voice and text

## API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `POST /session` - Session management
- `WS /ws` - WebSocket for real-time communication

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari (limited)
- Edge

## Troubleshooting

### Connection Issues
- Ensure both servers are running
- Check browser console for WebSocket errors
- Verify port 3001 is not blocked

### Speech Recognition Issues
- Use Chrome/Chromium browser
- Check microphone permissions
- Ensure HTTPS in production

### AI Response Issues
- Verify Gemini API key is correct
- Check server logs for errors
- Ensure internet connection

## Development

### Project Structure
```
voice_assistant/
├── src/
│   ├── components/
│   │   └── Home.jsx          # Main voice interface
│   ├── App.jsx
│   └── main.jsx
├── server/
│   ├── main.py               # FastAPI backend
│   ├── requirements.txt      # Python dependencies
│   └── .env                 # Environment variables
├── package.json
└── README.md
```

### Available Scripts
- `npm run dev` - Start frontend development server
- `npm run build` - Build for production
- `npm run start` - Start both frontend and backend
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
