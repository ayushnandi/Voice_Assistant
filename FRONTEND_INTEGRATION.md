# Frontend Integration Guide

## WebSocket Integration

Add this WebSocket connection code to your React component:

```javascript
import { useState, useEffect, useRef } from 'react';

const VoiceChat = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('Connected to server');
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'start_session' }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };
    
    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
  };

  const handleServerMessage = (data) => {
    switch (data.type) {
      case 'session_started':
        setMessages(prev => [...prev, { type: 'system', text: data.message }]);
        break;
        
      case 'ai_response':
        setMessages(prev => [...prev, { 
          type: 'ai', 
          text: data.response,
          latency: data.latency 
        }]);
        break;
        
      case 'error':
        setMessages(prev => [...prev, { type: 'error', text: data.message }]);
        break;
        
      case 'interrupted':
        setMessages(prev => [...prev, { type: 'system', text: data.message }]);
        break;
    }
  };

  const sendVoiceInput = (text) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'voice_input',
        text: text
      }));
      setMessages(prev => [...prev, { type: 'user', text }]);
    }
  };

  const interruptResponse = () => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  };

  const endSession = () => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current.close();
    }
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        endSession();
      }
    };
  }, []);

  return (
    <div className="voice-chat">
      <div className="status">
        Status: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.text}
            {msg.latency && <span className="latency">({msg.latency}ms)</span>}
          </div>
        ))}
      </div>
      
      <div className="controls">
        <button onClick={() => sendVoiceInput('Tell me about Revolt Motors')}>
          Test Message
        </button>
        <button onClick={interruptResponse}>Interrupt</button>
        <button onClick={endSession}>End Session</button>
      </div>
    </div>
  );
};

export default VoiceChat;
```

## Environment Configuration

Create a `.env` file in your React project root:

```env
REACT_APP_WS_URL=ws://localhost:3001
REACT_APP_API_URL=http://localhost:3001
```

## Testing the Integration

1. **Start the backend server:**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the React frontend:**
   ```bash
   npm run dev
   ```

3. **Test the connection:**
   - Open browser console
   - Check for WebSocket connection messages
   - Try sending test messages

## Error Handling

Add proper error handling for network issues:

```javascript
const handleConnectionError = (error) => {
  console.error('Connection error:', error);
  setMessages(prev => [...prev, { 
    type: 'error', 
    text: 'Connection failed. Please check your internet connection.' 
  }]);
};

// Add to WebSocket error handler
ws.onerror = handleConnectionError;
```

## Production Deployment

For production, update the WebSocket URL:

```javascript
const WS_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://your-domain.com' 
  : 'ws://localhost:3001';

const ws = new WebSocket(WS_URL);
```

## Next Steps

1. Implement voice recording functionality
2. Add real-time audio streaming
3. Implement speech-to-text conversion
4. Add text-to-speech for AI responses
5. Optimize for mobile devices 