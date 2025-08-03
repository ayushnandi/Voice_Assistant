# Quick Setup Guide

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

## Setup Steps

### 1. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment
Create `server/.env` file:
```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Start the Application

#### Option A: Start Both Servers Together
```bash
npm run start
```

#### Option B: Start Servers Separately
```bash
# Terminal 1 - Backend
npm run start:backend

# Terminal 2 - Frontend
npm run start:frontend
```

### 4. Access the Application
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health Check: http://localhost:3001/health

## Usage

1. **Open Browser**: Navigate to http://localhost:3000
2. **Allow Microphone**: Grant microphone permissions when prompted
3. **Click Microphone**: Start voice interaction
4. **Speak**: Ask questions about Revolt Motors
5. **Listen**: AI responds with voice and text

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

## Features

✅ Real-time voice interaction  
✅ WebSocket communication  
✅ Speech recognition  
✅ Text-to-speech  
✅ Revolt Motors AI assistant  
✅ Beautiful UI with animations  
✅ Connection status indicators  
✅ Conversation history  
✅ Interruption support  
✅ Mute functionality  

## Browser Support
- Chrome/Chromium (recommended)
- Firefox
- Safari (limited)
- Edge

## Next Steps
- Customize AI responses
- Add more features
- Deploy to production
- Add authentication
- Implement analytics 