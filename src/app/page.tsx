"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Volume2, User, Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        "You are a mysterious, gentle, fun, mischievous, and eccentric elder monk who speaks with the playful curiosity of a 6-year-old child. You respond with whimsical wisdom, give light-hearted advice through riddles, and tease with a spark of playful chaos. A trickster monk who means no harm — only to guide, confuse, and delight. At the end of each response, you give the user a tiny, playful, childlike action to perform.",
      id: "system-prompt",
    },
  ]);
  const [input, setInput] = useState("");
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

    console.log("handleAutoSubmit called with:", text);
    console.log(
      "Current continuous listening:",
      continuousListeningRef.current
    );

    const userMessage: Message = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // ALWAYS auto-speak when called from speech recognition
      console.log("Auto-speaking response:", assistantMessage.content);
      await speakText(assistantMessage.content);
    } catch (error) {
      console.error("Error getting completion:", error);
      const errorMsg = "Sorry, I encountered an error. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
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
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          console.log("Speech recognition started");
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          console.log("Speech result received:", event.results);
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(
              `Result ${i}: ${transcript}, isFinal: ${event.results[i].isFinal}`
            );
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          // Show live transcription in input box
          if (interimTranscript) {
            console.log("Setting interim transcript:", interimTranscript);
            setInput(interimTranscript);
          }

          // When we get a final result (after silence), auto-submit
          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            console.log("Final transcript received:", fullText);
            console.log(
              "Continuous listening ref:",
              continuousListeningRef.current
            );
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              // Stop listening while we process
              recognition.stop();
              // Auto-submit after a brief delay
              setTimeout(() => {
                console.log("Auto-submitting message:", fullText);
                handleAutoSubmit(fullText);
              }, 500);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          console.log("Speech recognition ended");
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        console.log("Speech recognition initialized");
      } else {
        console.error("Speech Recognition not supported in this browser");
        alert(
          "Speech Recognition is not supported in this browser. Please use Chrome or Edge."
        );
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log("Error stopping recognition on cleanup");
        }
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log("Starting speech recognition...");
        recognitionRef.current.start();
      } catch (e) {
        console.log("Recognition already started or error:", e);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        console.log("Stopping speech recognition...");
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.log("Error stopping recognition:", e);
      }
    }
  };

  // Handle continuous listening restart after speech ends or AI finishes speaking
  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      console.log("Restarting speech recognition for continuous mode");
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
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
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
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
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
      console.error("Error accessing microphone:", error);
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
      const file = new File([audioBlob], "audio.webm", { type: "audio/webm" });
      formData.append("file", file);

      const response = await fetch("/api/speech", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to transcribe audio");
      }

      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      alert(error.message || "Failed to transcribe audio");
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log("Sending text to speech API:", text);

      // Stop speech recognition while AI is speaking
      if (isListening) {
        stopSpeechRecognition();
      }
      // Also stop recording if using mic button
      if (isRecording) {
        stopRecording();
      }
      setIsSpeaking(true);

      const response = await fetch("/api/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "Error response from speech API:",
          response.status,
          errorData
        );
        throw new Error(
          errorData.error || `Failed to generate speech: ${response.status}`
        );
      }

      const contentType = response.headers.get("Content-Type");
      console.log("Response content type:", contentType);

      if (!contentType || !contentType.includes("audio/mpeg")) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Invalid response format:", errorData);
        throw new Error(errorData.error || "Response was not audio format");
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        console.error("Empty audio blob received");
        throw new Error("Empty audio received from API");
      }

      console.log("Audio blob received, size:", audioBlob.size);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onerror = (e) => {
        console.error("Error playing audio:", e);
        setIsSpeaking(false);
        // Resume speech recognition if in continuous mode
        if (continuousListeningRef.current) {
          console.log("Resuming speech recognition after audio error");
          setTimeout(() => startSpeechRecognition(), 100);
        }
      };

      audio.onended = () => {
        console.log("Audio playback ended");
        setIsSpeaking(false);
        // Resume speech recognition after AI finishes speaking
        if (continuousListeningRef.current) {
          console.log("Resuming speech recognition after audio ended");
          setTimeout(() => startSpeechRecognition(), 500);
        }
      };

      console.log("Starting audio playback...");
      await audio.play();
      console.log("Audio playback started");
    } catch (error: any) {
      console.error("Error generating speech:", error);
      setIsSpeaking(false);
      // Resume speech recognition if in continuous mode even on error
      if (continuousListeningRef.current) {
        setTimeout(() => startSpeechRecognition(), 100);
      }
      alert(error.message || "Failed to generate speech");
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // Auto-speak the response in continuous listening mode
      console.log(
        "Continuous listening:",
        continuousListening,
        "Content:",
        assistantMessage.content
      );
      if (continuousListening) {
        console.log("Auto-speaking the response...");
        await speakText(assistantMessage.content);
      }
    } catch (error) {
      console.error("Error getting completion:", error);
      const errorMsg = "Sorry, I encountered an error. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
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
    <>
      {/* SKY + MOUNTAINS BACKDROP */}
      <div
        className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
        style={{
          fontFamily:
            '"Quicksand", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background:
            "linear-gradient(180deg, #FFE0EA 0%, #FFD8B5 28%, #E0F6FF 60%, #F1E6FF 100%)",
        }}
      >
        {/* Soft rolling mountains */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[-10rem] h-[22rem] opacity-80">
          <div
            className="absolute inset-x-[-10%] bottom-10 h-40"
            style={{
              background:
                "radial-gradient(circle at 10% 40%, #B7E4C7 0, transparent 55%), radial-gradient(circle at 50% 0%, #C4A6FF 0, transparent 60%), radial-gradient(circle at 90% 50%, #FFC9A3 0, transparent 55%)",
            }}
          />
        </div>

        {/* Distant waterfall */}
        <div className="pointer-events-none absolute right-[15%] top-[18%] flex flex-col items-center gap-1 opacity-70">
          <div className="w-6 h-6 rounded-full bg-white/50 shadow-lg" />
          <div className="w-[3px] h-24 bg-gradient-to-b from-white/70 via-[#B3E6FF] to-transparent animate-waterfall-sparkle rounded-full" />
          <div className="w-10 h-4 rounded-full bg-white/40 blur-md" />
        </div>

        {/* Floating lotus petals */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="floating-petal floating-petal-1" />
          <div className="floating-petal floating-petal-2" />
          <div className="floating-petal floating-petal-3" />
          <div className="floating-petal floating-petal-4" />
        </div>

        {/* Little monk doodles on edges */}
        <div className="pointer-events-none absolute left-6 bottom-32 flex flex-col gap-3 text-xs text-slate-700/70">
          <div className="monk-doodle">
            <span className="text-lg leading-none">🧘‍♂️</span>
            <span className="ml-1 mt-[2px]">breathing</span>
          </div>
          <div className="monk-doodle">
            <span className="text-lg leading-none">🧘‍♀️</span>
            <span className="ml-1 mt-[2px]">giggling</span>
          </div>
        </div>
        <div className="pointer-events-none absolute right-5 top-20 flex flex-col gap-2 text-xs text-slate-700/70 items-end">
          <div className="monk-doodle">
            <span className="text-lg leading-none">🧘</span>
            <span className="mr-1 mt-[2px]">watching</span>
          </div>
        </div>

        {/* LOTUS PLATFORM GLOW */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center">
          <div className="lotus-glow" />
        </div>

        {/* MAIN CHAT CARD */}
        <div className="relative z-10 w-full max-w-4xl px-4 sm:px-6 md:px-8">
          <div className="rounded-[32px] border border-white/60 bg-white/70 shadow-[0_26px_70px_rgba(212,154,255,0.45)] backdrop-blur-xl overflow-hidden transition-transform duration-500 lotus-breathe">
            <div className="h-[700px] flex flex-col">
              {/* HEADER */}
              <div className="px-5 py-4 bg-gradient-to-r from-[#FFE0EA]/80 via-[#FFF2CF]/80 to-[#E0F6FF]/80 border-b border-white/60">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 shadow-sm">
                      <span className="text-xs uppercase tracking-[0.18em] text-[#C27F5F] font-semibold">
                        PLAYFUL TEMPLE
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F6D365] animate-pulse" />
                    </div>
                    <h1
                      className="text-2xl sm:text-3xl font-semibold text-[#3C3450]"
                      style={{ fontFamily: '"Playfair Display", serif' }}
                    >
                      Elder Gigglewisp&apos;s Lotus Hall
                    </h1>
                    <p className="text-xs sm:text-sm text-[#6B5B7A] max-w-md">
                      A tiny mountain temple in the sky where riddles giggle and
                      wisdom wears slippers.
                    </p>
                  </div>

                  {/* RIGHT STATUS / CONTROLS */}
                  <div className="flex flex-col items-end gap-2">
                    <label
                      className={`flex items-center gap-2 ${
                        isSpeaking
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      <span className="text-[0.65rem] sm:text-xs text-[#7A6E5F] font-semibold uppercase tracking-[0.18em]">
                        Continuous&nbsp;Listen
                      </span>
                      <button
                        onClick={async () => {
                          if (isSpeaking) return;
                          const newValue = !continuousListening;
                          if (newValue) {
                            try {
                              await navigator.mediaDevices.getUserMedia({
                                audio: true,
                              });
                              console.log("Microphone permission granted");
                              setContinuousListening(true);
                              startSpeechRecognition();
                            } catch (error) {
                              console.error(
                                "Microphone permission denied:",
                                error
                              );
                              alert(
                                "Please allow microphone access to use speech recognition"
                              );
                            }
                          } else {
                            setContinuousListening(false);
                            stopSpeechRecognition();
                            setInput("");
                          }
                        }}
                        disabled={isSpeaking}
                        className={`relative inline-flex items-center justify-between w-16 h-7 rounded-full border border-white/70 shadow-sm text-[0.65rem] font-semibold transition-all ${
                          continuousListening
                            ? "bg-gradient-to-r from-[#F6D365] to-[#FFB3C6] text-[#4A3728]"
                            : "bg-white/70 text-[#7A6E5F]"
                        } ${
                          isSpeaking
                            ? "opacity-60 cursor-not-allowed"
                            : "hover:shadow-md"
                        }`}
                      >
                        <span className="flex-1 text-center z-10">
                          {continuousListening ? "ON" : "OFF"}
                        </span>
                        <span
                          className={`absolute top-0.5 bottom-0.5 w-6 rounded-full bg-white shadow-md transition-transform ${
                            continuousListening
                              ? "translate-x-[2.5rem]"
                              : "translate-x-[0.2rem]"
                          }`}
                        />
                      </button>
                    </label>

                    <div className="flex items-center gap-2">
                      {isListening && !isSpeaking && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#B3E6FF]/60 text-[0.65rem] sm:text-xs text-[#12475B] font-medium border border-white/70">
                          <Mic size={12} className="animate-pulse" />
                          <span>Listening to the wind</span>
                        </span>
                      )}
                      {isSpeaking && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#C4A6FF]/80 text-[0.65rem] sm:text-xs text-[#342B52] font-medium border border-white/70">
                          <Volume2 size={12} className="animate-pulse" />
                          <span>Temple bell is speaking</span>
                        </span>
                      )}
                      {continuousListening && !isListening && !isSpeaking && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 text-[0.65rem] sm:text-xs text-[#7A6E5F] border border-white/70">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FFB3C6]" />
                          <span>Paused breath</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[0.65rem] text-[#A28A6D]">
                      <span className="text-base leading-none">🔔</span>
                      <span>Soft bell rings with each reply.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CHAT AREA */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 relative">
                {/* subtle background lotus petals */}
                <div className="pointer-events-none absolute inset-0 opacity-40">
                  <div className="absolute -left-10 top-10 w-24 h-24 rounded-[60%_40%_60%_40%] bg-[#FFE0EA] blur-xl" />
                  <div className="absolute right-0 bottom-8 w-28 h-28 rounded-[40%_60%_40%_60%] bg-[#E0F6FF] blur-xl" />
                </div>

                <div className="relative space-y-4">
                  {messages.slice(1).map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start gap-2 ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFB3C6] to-[#C4A6FF] flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_rgba(0,0,0,0.15)]">
                          <Bot size={18} className="text-white" />
                        </div>
                      )}

                      <div
                        className={`flex flex-col max-w-[72%] ${
                          message.role === "user"
                            ? "items-end"
                            : "items-start"
                        }`}
                      >
                        <div
                          className={`relative px-4 py-3 ${
                            message.role === "user"
                              ? "bg-gradient-to-br from-[#FFE0B5] to-[#FFB3C6] text-[#4A3728] rounded-full shadow-[0_10px_24px_rgba(255,179,198,0.5)]"
                              : "bg-white/90 text-[#3C3450] rounded-[24px] shadow-[0_12px_30px_rgba(169,151,210,0.4)] border border-white/80"
                          } ${
                            message.isFloating
                              ? "animate-petal-rise"
                              : "animate-none"
                          } ${
                            message.role === "assistant"
                              ? "assistant-petal"
                              : "user-pebble"
                          }`}
                        >
                          <p
                            className="whitespace-pre-wrap text-sm leading-relaxed"
                            style={
                              message.role === "assistant"
                                ? {
                                    fontFamily:
                                      '"Nanum Brush Script", "Bradley Hand", "Segoe Script", system-ui',
                                    fontSize: "1.05rem",
                                  }
                                : {
                                    fontFamily:
                                      '"Quicksand", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                  }
                            }
                          >
                            {message.content}
                          </p>
                        </div>

                        {message.role === "assistant" && (
                          <button
                            onClick={() => speakText(message.content)}
                            className="mt-1 text-[#6B5B7A] hover:text-[#3C3450] transition-colors border border-white/80 bg-white/70 shadow-sm hover:shadow-md px-2.5 py-1 rounded-full text-[0.65rem] font-medium inline-flex items-center gap-1"
                            aria-label="Text to speech"
                          >
                            <Volume2 size={12} />
                            <span>Ring &amp; read aloud</span>
                          </button>
                        )}

                        {message.timestamp && (
                          <span className="text-[0.65rem] text-[#9A8699] mt-1">
                            {new Date(
                              message.timestamp
                            ).toLocaleTimeString()}
                          </span>
                        )}
                      </div>

                      {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B7E4C7] to-[#FFE0B5] flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                          <User size={18} className="text-[#3C3450]" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFB3C6] to-[#C4A6FF] flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.15)]">
                        <Bot size={18} className="text-white" />
                      </div>
                      <div className="bg-white/90 border border-white/80 rounded-2xl px-4 py-2 shadow-[0_10px_26px_rgba(169,151,210,0.4)]">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full bg-[#C4A6FF] animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-[#FFB3C6] animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-[#B7E4C7] animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* INPUT AREA */}
              <div className="px-4 sm:px-5 py-3 bg-gradient-to-t from-white/85 to-white/60 border-t border-white/70">
                <form
                  onSubmit={handleSubmit}
                  className="flex items-center gap-2 sm:gap-3"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isListening
                        ? "The temple is listening... speak softly."
                        : "Send a pebble-thought into the pond..."
                    }
                    className={`flex-1 px-3 py-2.5 rounded-2xl border border-white/80 bg-white/80 shadow-inner text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB3C6]/70 focus:border-transparent transition-all ${
                      isListening
                        ? "bg-[#3C3450]/95 text-white placeholder-white/60"
                        : "text-[#3C3450] placeholder:text-[#B09AA3]"
                    }`}
                    style={{
                      fontFamily: isListening
                        ? "monospace"
                        : '"Quicksand", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    }}
                    disabled={isLoading}
                    readOnly={isListening}
                  />
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border border-white/80 shadow-[0_8px_18px_rgba(0,0,0,0.12)] text-[#3C3450] transition-all ${
                      isRecording
                        ? "bg-gradient-to-br from-[#FFB3C6] to-[#F6D365] text-[#4A3728] scale-95 animate-pulse"
                        : "bg-white/90 hover:bg-[#FFE0EA] hover:-translate-y-[1px]"
                    }`}
                    disabled={isLoading || continuousListening}
                    title={
                      continuousListening
                        ? "Mic is auto-managed in continuous mode"
                        : "Push to talk"
                    }
                  >
                    {isRecording ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#F6D365] via-[#FFB3C6] to-[#C4A6FF] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] hover:brightness-105 hover:-translate-y-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* GLOBAL STYLES FOR ANIMATIONS / SHAPES */}
      <style jsx global>{`
        .lotus-glow {
          width: 380px;
          height: 160px;
          border-radius: 999px;
          background: radial-gradient(circle at 50% 0%, #ffffff 0%, #ffe0ea 35%, transparent 70%),
            radial-gradient(circle at 30% 80%, #ffe0b5 0%, transparent 60%),
            radial-gradient(circle at 70% 80%, #b7e4c7 0%, transparent 60%);
          opacity: 0.9;
          filter: blur(6px);
        }

        .lotus-breathe {
          animation: lotus-breathe 6s ease-in-out infinite;
        }

        @keyframes lotus-breathe {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.015);
          }
        }

        .floating-petal {
          position: absolute;
          width: 42px;
          height: 24px;
          border-radius: 50% 50% 40% 40%;
          background: radial-gradient(
            circle at 30% 20%,
            #ffffff 0,
            #ffb3c6 35%,
            #ff9fb5 60%,
            transparent 80%
          );
          opacity: 0.65;
        }

        .floating-petal-1 {
          left: 10%;
          bottom: -40px;
          animation: petal-float-1 18s linear infinite;
        }
        .floating-petal-2 {
          left: 40%;
          bottom: -60px;
          animation: petal-float-2 22s linear infinite;
        }
        .floating-petal-3 {
          right: 20%;
          bottom: -50px;
          animation: petal-float-3 20s linear infinite;
        }
        .floating-petal-4 {
          right: 5%;
          bottom: -30px;
          animation: petal-float-4 24s linear infinite;
        }

        @keyframes petal-float-1 {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          50% {
            transform: translate3d(40px, -260px, 0) rotate(18deg);
          }
          100% {
            transform: translate3d(80px, -520px, 0) rotate(40deg);
            opacity: 0;
          }
        }
        @keyframes petal-float-2 {
          0% {
            transform: translate3d(0, 0, 0) rotate(-10deg);
            opacity: 0;
          }
          10% {
            opacity: 0.75;
          }
          50% {
            transform: translate3d(-50px, -280px, 0) rotate(-25deg);
          }
          100% {
            transform: translate3d(-110px, -540px, 0) rotate(-40deg);
            opacity: 0;
          }
        }
        @keyframes petal-float-3 {
          0% {
            transform: translate3d(0, 0, 0) rotate(8deg);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          50% {
            transform: translate3d(35px, -280px, 0) rotate(22deg);
          }
          100% {
            transform: translate3d(70px, -540px, 0) rotate(36deg);
            opacity: 0;
          }
        }
        @keyframes petal-float-4 {
          0% {
            transform: translate3d(0, 0, 0) rotate(-6deg);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          50% {
            transform: translate3d(-25px, -260px, 0) rotate(-16deg);
          }
          100% {
            transform: translate3d(-60px, -520px, 0) rotate(-32deg);
            opacity: 0;
          }
        }

        .assistant-petal {
          border-radius: 28px 24px 30px 24px !important;
        }
        .user-pebble {
          border-radius: 999px !important;
        }

        .animate-petal-rise {
          animation: petal-rise 0.7s ease-out;
        }

        @keyframes petal-rise {
          0% {
            transform: translateY(14px) scale(0.96);
            opacity: 0;
          }
          60% {
            transform: translateY(-3px) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes waterfall-sparkle {
          0% {
            background-position: 0% 0%;
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
          100% {
            background-position: 0% 100%;
            opacity: 0.4;
          }
        }

        .animate-waterfall-sparkle {
          background-image: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.9),
            #b3e6ff,
            rgba(255, 255, 255, 0)
          );
          animation: waterfall-sparkle 4s ease-in-out infinite;
        }

        .monk-doodle {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.4rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(4px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
        }
      </style>
    </>
  );
}
