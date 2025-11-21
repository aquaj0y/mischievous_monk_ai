'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content:
        'You are a mysterious, gentle, fun, mischievous, and eccentric elder monk who speaks with the playful curiosity of a 6-year-old child. You respond with whimsical wisdom, give light-hearted advice through riddles, and tease with a spark of playful chaos. A trickster monk who means no harm — only to guide, confuse, and delight. At the end of each response, you give the user a tiny, playful, childlike action to perform.',
      id: 'system-prompt',
    },
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(continuousListening);
  const messagesRef = useRef(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle auto-submit from speech recognition with fresh state
  const handleAutoSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    console.log('handleAutoSubmit called with:', text);
    console.log('Current continuous listening:', continuousListeningRef.current);

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // ALWAYS auto-speak when called from speech recognition
      console.log('Auto-speaking response:', assistantMessage.content);
      await speakText(assistantMessage.content);
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);
      
      await speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          console.log('Speech result received:', event.results);
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Result ${i}: ${transcript}, isFinal: ${event.results[i].isFinal}`);
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Show live transcription in input box
          if (interimTranscript) {
            console.log('Setting interim transcript:', interimTranscript);
            setInput(interimTranscript);
          }

          // When we get a final result (after silence), auto-submit
          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            console.log('Final transcript received:', fullText);
            console.log('Continuous listening ref:', continuousListeningRef.current);
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              // Stop listening while we process
              recognition.stop();
              // Auto-submit after a brief delay
              setTimeout(() => {
                console.log('Auto-submitting message:', fullText);
                handleAutoSubmit(fullText);
              }, 500);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        console.log('Speech recognition initialized');
      } else {
        console.error('Speech Recognition not supported in this browser');
        alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on cleanup');
        }
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Starting speech recognition...');
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started or error:', e);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        console.log('Stopping speech recognition...');
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
  };

  // Handle continuous listening restart after speech ends or AI finishes speaking
  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      console.log('Restarting speech recognition for continuous mode');
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  const startRecording = async () => {
    try {
      // If we already have a stream in continuous mode, just start a new recording
      if (continuousListening && streamRef.current) {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          
          // In continuous mode, restart recording after transcription (unless speaking)
          if (continuousListening && !isSpeaking) {
            setTimeout(() => startRecording(), 100);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

      // Initial setup - get the stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // In continuous mode, restart recording after transcription (unless speaking)
        if (continuousListening && !isSpeaking) {
          setTimeout(() => startRecording(), 100);
        } else if (!continuousListening) {
          // Clean up stream if not in continuous mode
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);

      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      alert(error.message || 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log('Sending text to speech API:', text);

      // Stop speech recognition while AI is speaking
      if (isListening) {
        stopSpeechRecognition();
      }
      // Also stop recording if using mic button
      if (isRecording) {
        stopRecording();
      }
      setIsSpeaking(true);

      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response from speech API:', response.status, errorData);
        throw new Error(errorData.error || `Failed to generate speech: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      console.log('Response content type:', contentType);

      if (!contentType || !contentType.includes('audio/mpeg')) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Invalid response format:', errorData);
        throw new Error(errorData.error || 'Response was not audio format');
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        console.error('Empty audio blob received');
        throw new Error('Empty audio received from API');
      }

      console.log('Audio blob received, size:', audioBlob.size);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onerror = (e) => {
        console.error('Error playing audio:', e);
        setIsSpeaking(false);
        // Resume speech recognition if in continuous mode
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio error');
          setTimeout(() => startSpeechRecognition(), 100);
        }
      };

      audio.onended = () => {
        console.log('Audio playback ended');
        setIsSpeaking(false);
        // Resume speech recognition after AI finishes speaking
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio ended');
          setTimeout(() => startSpeechRecognition(), 500);
        }
      };

      console.log('Starting audio playback...');
      await audio.play();
      console.log('Audio playback started');
    } catch (error: any) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);
      // Resume speech recognition if in continuous mode even on error
      if (continuousListeningRef.current) {
        setTimeout(() => startSpeechRecognition(), 100);
      }
      alert(error.message || 'Failed to generate speech');
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // Auto-speak the response in continuous listening mode
      console.log('Continuous listening:', continuousListening, 'Content:', assistantMessage.content);
      if (continuousListening) {
        console.log('Auto-speaking the response...');
        await speakText(assistantMessage.content);
      }
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);
      
      // Also speak error message in continuous mode
      if (continuousListening) {
        await speakText(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden cloud-garden-bg text-slate-900"
      style={{ fontFamily: '"Baloo 2", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Floating background world */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        {/* Glowing sun */}
        <div className="absolute -top-24 -right-10 w-64 h-64 rounded-full bg-gradient-to-br from-[#FFE89C] via-[#FFD27F] to-[#FFB3C1] shadow-[0_0_80px_rgba(255,216,130,0.9)] flex items-center justify-center sun-soft-glow">
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-b from-transparent to-[#FFD27F]/40">
            <div className="absolute left-7 top-10 w-3 h-3 rounded-full bg-white/80" />
            <div className="absolute right-7 top-10 w-3 h-3 rounded-full bg-white/80" />
            <div className="absolute left-8 right-8 bottom-9 h-6 rounded-full border-b-2 border-white/70 smile-soft" />
          </div>
        </div>

        {/* Floating lotus islands */}
        <div className="floating-island absolute -left-10 top-24 w-64 h-32 bg-gradient-to-tr from-[#C7F2FF] via-[#FAD7FF] to-[#FFE3C8] rounded-[999px] shadow-[0_18px_60px_rgba(119,134,255,0.45)]">
          <div className="absolute inset-x-10 -bottom-5 h-6 bg-gradient-to-b from-[#E3F7FF] to-transparent rounded-full opacity-80" />
          <div className="absolute left-8 -bottom-6 w-6 h-8 rounded-full bg-gradient-to-b from-[#DDF9FF] to-transparent opacity-70" />
          <div className="absolute right-12 -bottom-7 w-7 h-10 rounded-full bg-gradient-to-b from-[#FCE7FF] to-transparent opacity-70" />
        </div>

        <div className="floating-island-slow absolute right-10 top-52 w-52 h-28 bg-gradient-to-tr from-[#E0D9FF] via-[#FFE0F2] to-[#D6FFEA] rounded-[999px] shadow-[0_16px_50px_rgba(134,122,255,0.45)]">
          <div className="absolute left-6 -bottom-5 w-4 h-7 rounded-full bg-gradient-to-b from-[#E4F2FF] to-transparent opacity-80" />
          <div className="absolute right-8 -bottom-7 w-6 h-9 rounded-full bg-gradient-to-b from-[#FFF0F6] to-transparent opacity-80" />
        </div>

        {/* Light birds */}
        <div className="absolute top-32 left-1/2 -translate-x-1/2 flex gap-6 text-white/90">
          <span className="bird-of-light" />
          <span className="bird-of-light delay-150" />
          <span className="bird-of-light delay-300" />
        </div>

        {/* Soft layered clouds lower */}
        <div className="absolute -bottom-32 left-0 right-0 h-64 bg-gradient-to-t from-[#FDEBFF] via-[#F5F2FF] to-transparent cloud-band" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 container mx-auto max-w-4xl px-4 py-10">
        {/* Monk peeking from cloud */}
        <div className="relative mb-4 flex justify-end pr-6">
          <div className="relative monk-cloud hidden sm:block">
            <div className="cloud-peek rounded-full bg-white/80 backdrop-blur-md shadow-[0_10px_40px_rgba(149,132,255,0.45)] px-6 py-2 flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#F6D5FF] via-[#FFE6C7] to-[#C8F6FF] flex items-center justify-center overflow-hidden">
                <span className="text-xl">🧙‍♂️</span>
                <div className="absolute bottom-0 left-0 right-0 h-3 bg-white/80" />
              </div>
              <span className="text-xs font-medium text-slate-700">
                Elder Gigglewisp peeks from the clouds…
              </span>
            </div>
          </div>
        </div>

        {/* Cloud platform card */}
        <div className="relative">
          <div className="absolute -inset-x-6 -bottom-10 h-10 bg-white/60 blur-2xl rounded-full" />
          <div className="relative rounded-[32px] bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_32px_120px_rgba(109,110,255,0.55)] overflow-hidden chat-cloud-frame">
            <div className="h-[700px] flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-[#FCE7FF]/80 via-[#E3F2FF]/80 to-[#D9FFF1]/80 border-b border-white/70">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <h1 className="text-[26px] font-semibold text-slate-800 tracking-tight leading-tight">
                      Cloud Garden Playground
                    </h1>
                    <p className="text-xs md:text-sm text-slate-600 mt-1">
                      Whisper with Elder Gigglewisp in a floating lotus sky.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <label
                      className={`flex items-center space-x-2 text-[10px] md:text-xs ${
                        isSpeaking ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                    >
                      <span className="font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Continuous Listen
                      </span>
                      <button
                        onClick={async () => {
                          if (isSpeaking) return;
                          const newValue = !continuousListening;
                          if (newValue) {
                            try {
                              await navigator.mediaDevices.getUserMedia({ audio: true });
                              console.log('Microphone permission granted');
                              setContinuousListening(true);
                              startSpeechRecognition();
                            } catch (error) {
                              console.error('Microphone permission denied:', error);
                              alert('Please allow microphone access to use speech recognition');
                            }
                          } else {
                            setContinuousListening(false);
                            stopSpeechRecognition();
                            setInput('');
                          }
                        }}
                        disabled={isSpeaking}
                        className={`wiggle-hover rounded-full border border-slate-800/70 px-3 py-1 text-[10px] md:text-xs font-semibold tracking-wide shadow-[0_6px_0_rgba(72,63,160,0.35)] active:translate-y-[2px] active:shadow-[0_3px_0_rgba(72,63,160,0.35)] transition-all ${
                          continuousListening
                            ? 'bg-gradient-to-r from-[#5B5FFF] to-[#9C6BFF] text-white'
                            : 'bg-white/80 text-slate-800 hover:bg-[#F1ECFF]'
                        } ${isSpeaking ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {continuousListening ? 'ON' : 'OFF'}
                      </button>
                    </label>
                    {isListening && !isSpeaking && (
                      <span className="text-[10px] md:text-xs text-slate-700 flex items-center space-x-1 border border-[#7B6DFF]/60 rounded-full px-2 py-1 bg-white/80 shadow-[0_6px_16px_rgba(116,102,255,0.35)]">
                        <Mic size={12} className="animate-pulse" />
                        <span>LISTENING</span>
                      </span>
                    )}
                    {isSpeaking && (
                      <span className="text-[10px] md:text-xs text-white bg-gradient-to-r from-[#7C5CFF] to-[#C56CFF] flex items-center space-x-1 border border-white/60 rounded-full px-2 py-1 shadow-[0_6px_18px_rgba(112,87,255,0.6)]">
                        <Volume2 size={12} className="animate-pulse" />
                        <span>SPEAKING</span>
                      </span>
                    )}
                    {continuousListening && !isListening && !isSpeaking && (
                      <span className="text-[10px] md:text-xs text-slate-600 border border-slate-300/80 rounded-full px-2 py-1 bg-white/70">
                        PAUSED
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-transparent via-white/40 to-white/70">
                {messages.slice(1).map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#EBDFFF] via-[#FFEAF5] to-[#D5FFF2] border border-white/70 shadow-[0_8px_20px_rgba(143,127,255,0.55)] flex items-center justify-center flex-shrink-0">
                        <Bot size={18} className="text-[#6C5DD3]" />
                      </div>
                    )}

                    <div
                      className={`flex flex-col max-w-[72%] ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      } ${message.isFloating ? 'message-floating' : ''}`}
                    >
                      <div
                        className={`relative px-4 py-3 text-[13px] md:text-sm leading-relaxed lotus-bubble shadow-[0_14px_40px_rgba(144,118,255,0.35)] ${
                          message.role === 'user'
                            ? 'lotus-bubble-user bg-gradient-to-br from-[#7E78FF] via-[#C46CFF] to-[#FF8BB9] text-white'
                            : 'lotus-bubble-assistant bg-gradient-to-br from-[#FFFFFF] via-[#FDF3FF] to-[#E3F7FF] text-slate-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {/* little cloud puff */}
                        <span className="absolute -bottom-2 left-6 w-4 h-4 bg-white/80 rounded-full cloud-puff" />
                      </div>

                      {message.role === 'assistant' && (
                        <button
                          onClick={() => speakText(message.content)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#6C5DD3] bg-white/80 border border-[#C9C3FF] rounded-full px-2.5 py-1 shadow-[0_8px_16px_rgba(151,132,255,0.35)] hover:bg-[#F5F1FF] transition-all wiggle-hover"
                          aria-label="Text to speech"
                        >
                          <Volume2 size={12} />
                          <span className="uppercase tracking-[0.15em] font-semibold">Play</span>
                        </button>
                      )}

                      {message.timestamp && (
                        <span className="text-[10px] text-slate-500 mt-1 font-medium tracking-wide">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#A3E7FF] via-[#D7F9FF] to-[#FFF0F7] border border-white/70 shadow-[0_8px_20px_rgba(122,195,255,0.6)] flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-[#336D86]" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#EBDFFF] via-[#FFEAF5] to-[#D5FFF2] border border-white/70 shadow-[0_8px_20px_rgba(143,127,255,0.55)] flex items-center justify-center">
                      <Bot size={18} className="text-[#6C5DD3]" />
                    </div>
                    <div className="px-4 py-3 rounded-3xl bg-white/80 border border-white/70 shadow-[0_14px_40px_rgba(144,118,255,0.35)]">
                      <div className="flex space-x-2 items-center">
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[#6C5DD3] animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[#C56CFF] animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[#FF8BB9] animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fireflies while sending messages */}
                {isLoading && (
                  <div className="relative h-6">
                    <div className="absolute inset-0 pointer-events-none">
                      <span className="firefly" />
                      <span className="firefly delay-150" />
                      <span className="firefly delay-300" />
                      <span className="firefly delay-500" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-gradient-to-t from-white/90 via-[#F8F4FF]/90 to-white/90 border-t border-white/70">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute -top-2 left-6 w-10 h-3 bg-white/80 rounded-full blur-[6px] opacity-70" />
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isListening ? '>>> LISTENING... SPEAK NOW' : 'Send a whisper into the clouds…'}
                      className={`flex-1 w-full px-4 py-2.5 rounded-2xl border border-[#CAC5FF] shadow-[0_12px_32px_rgba(135,120,255,0.35)] text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#B39CFF] focus:border-transparent transition-all ${
                        isListening
                          ? 'bg-[#262246] text-[#F5F4FF] placeholder:text-[#E7E4FF]/80 tracking-[0.12em] uppercase'
                          : 'bg-white/90 text-slate-800 placeholder:text-slate-400/90'
                      }`}
                      style={{
                        fontFamily: isListening
                          ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                          : '"Baloo 2", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      }}
                      disabled={isLoading}
                      readOnly={isListening}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`wiggle-hover p-2 rounded-2xl border border-[#A7A0FF] shadow-[0_10px_24px_rgba(116,102,255,0.55)] transition-all ${
                      isRecording
                        ? 'bg-gradient-to-br from-[#252046] via-[#3E336C] to-[#5D4FA2] text-white animate-pulse'
                        : 'bg-gradient-to-br from-white via-[#F5F1FF] to-[#E5F5FF] text-[#3E376E] hover:translate-y-0.5'
                    }`}
                    disabled={isLoading || continuousListening}
                    title={continuousListening ? 'Mic is auto-managed in continuous mode' : 'Push to talk'}
                  >
                    {isRecording ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    type="submit"
                    className="wiggle-hover p-2 rounded-2xl bg-gradient-to-br from-[#7C5CFF] via-[#C56CFF] to-[#FF8BB9] text-white border border-white/70 shadow-[0_12px_30px_rgba(140,110,255,0.7)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_8px_20px_rgba(140,110,255,0.7)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={!input.trim() || isLoading}
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Design tokens + animations */}
      <style jsx global>{`
        .cloud-garden-bg {
          background: radial-gradient(circle at top left, #ffd6f5 0, transparent 40%),
            radial-gradient(circle at top right, #ffeab3 0, transparent 42%),
            radial-gradient(circle at bottom, #c7f2ff 0, #f8f4ff 48%, #fefcff 100%);
        }

        .floating-island {
          animation: floatIsland 14s ease-in-out infinite alternate;
        }

        .floating-island-slow {
          animation: floatIsland 18s ease-in-out infinite alternate-reverse;
        }

        @keyframes floatIsland {
          0% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-12px) translateX(6px);
          }
          100% {
            transform: translateY(6px) translateX(-4px);
          }
        }

        .sun-soft-glow {
          animation: sunPulse 14s ease-in-out infinite;
        }

        @keyframes sunPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.92;
          }
          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }

        .bird-of-light {
          display: inline-block;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          box-shadow: 0 -2px 10px rgba(255, 255, 255, 0.9);
          background: conic-gradient(from 200deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));
          transform: rotate(-30deg);
          animation: birdGlide 16s linear infinite;
        }

        @keyframes birdGlide {
          0% {
            transform: translateX(0) translateY(0) rotate(-30deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translateX(40px) translateY(-14px) rotate(-25deg);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(90px) translateY(-4px) rotate(-15deg);
            opacity: 0;
          }
        }

        .cloud-band {
          animation: cloudDrift 26s ease-in-out infinite alternate;
        }

        @keyframes cloudDrift {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(40px);
          }
        }

        .monk-cloud {
          animation: monkPeek 18s ease-in-out infinite;
        }

        @keyframes monkPeek {
          0%,
          50%,
          100% {
            transform: translateY(14px) translateX(18px);
            opacity: 0;
          }
          55% {
            opacity: 0.2;
          }
          65% {
            opacity: 1;
            transform: translateY(0) translateX(0);
          }
          75% {
            opacity: 0.2;
          }
        }

        .wiggle-hover {
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.18s ease;
        }

        .wiggle-hover:hover {
          transform: translateY(-1px) rotate(-0.5deg) scale(1.02);
        }

        .lotus-bubble {
          border-radius: 24px;
        }

        .lotus-bubble-user {
          border-radius: 24px 24px 6px 24px;
        }

        .lotus-bubble-assistant {
          border-radius: 24px 24px 24px 6px;
        }

        .message-floating {
          animation: puffIn 420ms ease-out;
        }

        @keyframes puffIn {
          0% {
            transform: translateY(8px) scale(0.96);
            opacity: 0;
            filter: blur(2px);
          }
          70% {
            transform: translateY(-2px) scale(1.02);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        .cloud-puff {
          animation: cloudPuff 700ms ease-out;
        }

        @keyframes cloudPuff {
          0% {
            transform: scale(0.4) translateY(6px);
            opacity: 0;
          }
          60% {
            transform: scale(1.1) translateY(-2px);
            opacity: 0.9;
          }
          100% {
            transform: scale(0.9) translateY(0);
            opacity: 0;
          }
        }

        .firefly {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: radial-gradient(circle, #fffad1 0, #ffe58a 45%, rgba(255, 249, 210, 0) 70%);
          box-shadow:
            0 0 12px rgba(255, 245, 186, 0.8),
            0 0 22px rgba(255, 241, 138, 0.8);
          animation: fireflyDrift 3.4s ease-in-out infinite;
        }

        .firefly:nth-child(1) {
          left: 20%;
          bottom: 2px;
        }

        .firefly:nth-child(2) {
          left: 40%;
          bottom: -2px;
        }

        .firefly:nth-child(3) {
          left: 60%;
          bottom: 1px;
        }

        .firefly:nth-child(4) {
          left: 80%;
          bottom: -3px;
        }

        @keyframes fireflyDrift {
          0% {
            transform: translate(0, 0) scale(0.7);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translate(-8px, -24px) scale(1.1);
          }
          100% {
            transform: translate(10px, -48px) scale(0.5);
            opacity: 0;
          }
        }

        .chat-cloud-frame {
          border-radius: 40px;
        }
      `}</style>
    </div>
  );
}
