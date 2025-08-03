import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';

function Home() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isActiveListening, setIsActiveListening] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState(false);

  // WebSocket and audio refs
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  
  // Voice Activity Detection refs
  const vadStreamRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const vadDataArrayRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const speechStartTimeRef = useRef(null);

  // VAD configuration
  const VAD_THRESHOLD = 0.01; // Adjust sensitivity (0.001 = very sensitive, 0.1 = less sensitive)
  const MIN_SPEECH_DURATION = 500; // Minimum speech duration in ms
  const SILENCE_DURATION = 1500; // Silence duration before stopping in ms

  // Initialize WebSocket connection
  useEffect(() => {
    connectToServer();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopActiveListening();
    };
  }, []);

  const connectToServer = () => {
    try {
      wsRef.current = new WebSocket('ws://localhost:3001/ws');
      
      wsRef.current.onopen = () => {
        console.log('Connected to server');
        setIsConnected(true);
        setConnectionStatus('Connected');
        wsRef.current.send(JSON.stringify({ type: 'start_session' }));
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      };

      wsRef.current.onclose = () => {
        console.log('Disconnected from server');
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        setTimeout(connectToServer, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
      };
    } catch (error) {
      console.error('Failed to connect to server:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const handleServerMessage = (data) => {
    switch (data.type) {
      case 'session_started':
        setConnectionStatus('Ready');
        break;
        
      case 'audio_response':
        if (!isMuted) {
          playAudioResponse(data.audio);
        }
        break;
        
      case 'turn_complete':
        setIsSpeaking(false);
        if (isActiveListening) {
          startActiveListening();
        }
        break;
        
      case 'error':
        console.error('Server error:', data.message);
        setConnectionStatus('Error');
        break;
        
      case 'session_ended':
        setConnectionStatus('Session Ended');
        break;
    }
  };

  const playAudioResponse = async (base64Audio) => {
    try {
      setIsSpeaking(true);
      stopActiveListening(); // Stop listening while AI is speaking
      
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
        channelData[i] = sample < 32768 ? sample / 32768 : (sample - 65536) / 32768;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsSpeaking(false);
        if (isActiveListening) {
          setTimeout(() => startActiveListening(), 500); // Resume listening after AI finishes
        }
      };
      
      source.start();
      
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  };

  // Voice Activity Detection functions
  const initializeVAD = async () => {
    try {
      vadStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(vadStreamRef.current);
      vadAnalyserRef.current = audioContext.createAnalyser();
      vadAnalyserRef.current.fftSize = 2048;
      vadAnalyserRef.current.smoothingTimeConstant = 0.8;

      source.connect(vadAnalyserRef.current);
      vadDataArrayRef.current = new Uint8Array(vadAnalyserRef.current.frequencyBinCount);

      return true;
    } catch (error) {
      console.error('Error initializing VAD:', error);
      return false;
    }
  };

  const detectVoiceActivity = () => {
    if (!vadAnalyserRef.current || !vadDataArrayRef.current) return false;

    vadAnalyserRef.current.getByteFrequencyData(vadDataArrayRef.current);
    
    // Calculate RMS (Root Mean Square) energy
    let sum = 0;
    for (let i = 0; i < vadDataArrayRef.current.length; i++) {
      sum += vadDataArrayRef.current[i] * vadDataArrayRef.current[i];
    }
    const rms = Math.sqrt(sum / vadDataArrayRef.current.length);
    const normalizedRms = rms / 255;

    return normalizedRms > VAD_THRESHOLD;
  };

  const startActiveListening = async () => {
    if (isSpeaking || !isConnected) return;

    const vadInitialized = await initializeVAD();
    if (!vadInitialized) return;

    vadIntervalRef.current = setInterval(() => {
      const hasVoiceActivity = detectVoiceActivity();
      setVoiceActivity(hasVoiceActivity);

      if (hasVoiceActivity && !isListening) {
        // Voice detected, start recording
        if (!speechStartTimeRef.current) {
          speechStartTimeRef.current = Date.now();
        }
        
        // Only start recording if speech has been detected for minimum duration
        if (Date.now() - speechStartTimeRef.current >= MIN_SPEECH_DURATION) {
          startRecording();
        }
        
        // Clear silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      } else if (!hasVoiceActivity && isListening) {
        // No voice activity, start silence timeout
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            stopRecording();
            speechStartTimeRef.current = null;
          }, SILENCE_DURATION);
        }
      } else if (!hasVoiceActivity) {
        // Reset speech start time if no activity
        speechStartTimeRef.current = null;
      }
    }, 100);
  };

  const stopActiveListening = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach(track => track.stop());
      vadStreamRef.current = null;
    }

    setVoiceActivity(false);
    speechStartTimeRef.current = null;
  };

  const startRecording = async () => {
    if (isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsListening(true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      if (!isActiveListening) {
        alert('Microphone access denied. Please enable microphone permissions.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const processAudioBlob = async (audioBlob) => {
    try {
      // Convert WebM to WAV format for backend processing
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Resample to 16kHz mono for speech recognition
      const targetSampleRate = 16000;
      const channelData = audioBuffer.getChannelData(0);
      const samples = audioBuffer.length;
      const newLength = Math.round(samples * targetSampleRate / audioBuffer.sampleRate);
      const resampledData = new Float32Array(newLength);
      
      // Simple linear interpolation resampling
      for (let i = 0; i < newLength; i++) {
        const originalIndex = i * samples / newLength;
        const index = Math.floor(originalIndex);
        const fraction = originalIndex - index;
        
        if (index + 1 < samples) {
          resampledData[i] = channelData[index] * (1 - fraction) + channelData[index + 1] * fraction;
        } else {
          resampledData[i] = channelData[index];
        }
      }
      
      // Convert to 16-bit PCM
      const pcmData = new Int16Array(resampledData.length);
      for (let i = 0; i < resampledData.length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32768));
      }
      
      // Create WAV file buffer
      const wavBuffer = createWavFile(pcmData, targetSampleRate);
      const base64Audio = arrayBufferToBase64(wavBuffer);
      
      console.log('Sending audio to server...');
      
      // Send to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'send_audio',
          audio: base64Audio
        }));
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  const createWavFile = (pcmData, sampleRate) => {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length * 2, true);
    
    // PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(offset, pcmData[i], true);
      offset += 2;
    }
    
    return buffer;
  };

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleMicClick = () => {
    if (!isConnected) {
      alert('Not connected to server. Please wait...');
      return;
    }

    if (isSpeaking) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
      }
      setIsSpeaking(false);
    }

    if (isActiveListening) {
      // Toggle off active listening
      setIsActiveListening(false);
      stopActiveListening();
      if (isListening) {
        stopRecording();
      }
    } else {
      // Toggle on active listening
      setIsActiveListening(true);
      startActiveListening();
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const RobotAvatar = () => (
    <div className="relative mb-8">
      <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-b ${
        isDarkMode 
          ? 'from-emerald-400 to-emerald-500' 
          : 'from-blue-400 to-blue-500'
      } relative transition-all duration-300 ${
        isSpeaking ? 'animate-bounce' : voiceActivity ? 'scale-110' : ''
      }`}>
        <div className="absolute top-4 left-3 w-3 h-3 bg-white rounded-full"></div>
        <div className="absolute top-4 right-3 w-3 h-3 bg-white rounded-full"></div>
        
        <div className={`absolute bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-2 bg-white rounded-full transition-all duration-200 ${
          isSpeaking ? 'h-3 animate-pulse' : voiceActivity ? 'h-2.5' : ''
        }`}></div>
        
        <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 w-1 h-4 rounded-full ${
          isDarkMode ? 'bg-emerald-600' : 'bg-blue-600'
        }`}></div>
        <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full ${
          isDarkMode ? 'bg-emerald-400' : 'bg-blue-400'
        }`}></div>
      </div>
      
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-blue-500' : 'bg-red-500'} animate-pulse`}></div>
      </div>
    </div>
  );

  const themeClasses = {
    background: isDarkMode ? 'bg-gray-900' : 'bg-gray-100',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textTertiary: isDarkMode ? 'text-gray-500' : 'text-gray-500',
    buttonBg: isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50 shadow-lg',
    iconColor: isDarkMode ? 'text-gray-400' : 'text-gray-600'
  };

  return (
    <div className={`min-h-screen ${themeClasses.background} flex items-center justify-center relative overflow-hidden transition-colors duration-300`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}></div>
      </div>
      
      {/* Top Navigation */}
      <div className="absolute top-6 left-6 flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 ${isDarkMode ? 'bg-white' : 'bg-gray-900'} rounded transform rotate-45`}></div>
          <span className={`${themeClasses.text} font-semibold text-lg`}>REVOLT</span>
        </div>
      </div>
      
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <div 
          onClick={toggleTheme}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${
            isDarkMode ? 'bg-blue-500' : 'bg-yellow-400'
          }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 ${
            isDarkMode ? 'ml-auto' : 'ml-0'
          }`}></div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="text-center z-10">
        <RobotAvatar />
        
        <h1 className={`text-4xl font-light ${themeClasses.text} mb-12`}>
          Talk to Rev
        </h1>
        
        {/* Microphone Button */}
        <div className="relative">
          {/* Active listening pulse rings */}
          {isActiveListening && !isSpeaking && (
            <>
              <div className={`absolute inset-0 rounded-full opacity-30 animate-ping ${
                voiceActivity ? 'bg-green-500' : 'bg-blue-500'
              }`}></div>
              <div className={`absolute inset-0 rounded-full opacity-20 animate-ping ${
                voiceActivity ? 'bg-green-500' : 'bg-blue-500'
              }`} style={{ animationDelay: '0.5s' }}></div>
            </>
          )}
          
          {/* Manual listening rings */}
          {isListening && !isActiveListening && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping"></div>
              <div className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping" style={{ animationDelay: '0.5s' }}></div>
            </>
          )}
          
          {/* Speaking indicator rings */}
          {isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-20 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
            </>
          )}
          
          <button
            onClick={handleMicClick}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 cursor-pointer ${
              isSpeaking
                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                : isActiveListening
                ? voiceActivity 
                  ? 'bg-green-500 shadow-lg shadow-green-500/30'
                  : 'bg-blue-500 shadow-lg shadow-blue-500/30'
                : 'bg-gray-600 hover:bg-gray-500 shadow-lg shadow-gray-500/30'
            }`}
          >
            {isActiveListening ? (
              <Mic className="w-8 h-8 text-white" />
            ) : (
              <MicOff className="w-8 h-8 text-white" />
            )}
          </button>
        </div>
        
        {/* Status Text */}
        <div className="mt-6 h-6">
          <p className={`${themeClasses.textSecondary} text-lg`}>
            {isSpeaking && "Rev is speaking..."}
            {isActiveListening && !isSpeaking && (voiceActivity ? "Listening..." : "Waiting for voice...")}
            {!isActiveListening && !isSpeaking && !isConnected && "Connecting..."}
            {!isActiveListening && !isSpeaking && isConnected && "Tap to enable active listening"}
          </p>
        </div>
        
        {/* Control Buttons */}
        <div className="flex justify-center space-x-4 mt-12">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full ${themeClasses.buttonBg} flex items-center justify-center transition-all duration-200`}
          >
            {isMuted ? (
              <VolumeX className={`w-5 h-5 ${themeClasses.iconColor}`} />
            ) : (
              <Volume2 className={`w-5 h-5 ${themeClasses.iconColor}`} />
            )}
          </button>
          
          <button className={`w-12 h-12 rounded-full ${themeClasses.buttonBg} flex items-center justify-center transition-all duration-200`}>
            <Settings className={`w-5 h-5 ${themeClasses.iconColor}`} />
          </button>
        </div>
        
        {/* Connection Status */}
        <div className="mt-8 flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`${themeClasses.textTertiary} text-sm`}>
            {connectionStatus}
            {isActiveListening && " • Active Listening"}
          </span>
        </div>
      </div>
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 ${isDarkMode ? 'bg-white' : 'bg-gray-900'} opacity-10 rounded-full animate-float`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${10 + Math.random() * 20}s`
            }}
          ></div>
        ))}
      </div>
      
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        .animate-float {
          animation: float 20s infinite linear;
        }
      `}</style>
    </div>
  );
}

export default Home;