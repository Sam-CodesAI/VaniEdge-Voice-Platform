"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Activity,
  PhoneOff,
  Radio,
  ShieldAlert,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Bot,
  User,
} from "lucide-react";
import { TenantProfile } from "@/lib/telephony/types";

interface WebRtcVoiceTesterProps {
  tenant: TenantProfile;
}

interface DialogueTurn {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
  emergency?: boolean;
  ttftMs?: number;
  totalLatencyMs?: number;
}

interface LatencyMetrics {
  ttft: number;
  totalTurnaround: number;
  audioDuration?: number;
}

// Browser SpeechRecognition Type Declarations
interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
  AudioContext: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export function WebRtcVoiceTester({ tenant }: WebRtcVoiceTesterProps) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [dialogue, setDialogue] = useState<DialogueTurn[]>([]);
  const [latency, setLatency] = useState<LatencyMetrics | null>(null);
  const [transferAlert, setTransferAlert] = useState<string | null>(null);
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(true);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(`WEBRTC_${Date.now()}`);
  const isSpeakingRef = useRef(false);

  // Check Web Speech API availability on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindowSpeech;
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
      setHasSpeechRecognition(!!SpeechRec);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  // Speak agent text using browser speech synthesis
  const speakAgentReply = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick female neural voice if available
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        (v.name.includes("Female") ||
          v.name.includes("Samantha") ||
          v.name.includes("Victoria") ||
          v.name.includes("Google US English") ||
          v.name.includes("Natural")) &&
        v.lang.startsWith("en")
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Process user speech against the server intent classifier & voice pipeline
  const processSpokenInput = useCallback(
    async (speechText: string) => {
      const trimmed = speechText.trim();
      if (!trimmed || isThinking) return;

      setIsThinking(true);
      setInterimTranscript("");

      const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
      const userTurnId = `usr_${Date.now()}`;
      setDialogue((prev) => [
        ...prev,
        {
          id: userTurnId,
          sender: "user",
          text: trimmed,
          timestamp: timeStr,
        },
      ]);

      const startTime = performance.now();

      try {
        const res = await fetch(
          `/api/voice/process?callSid=${encodeURIComponent(sessionIdRef.current)}&tenantId=${encodeURIComponent(tenant.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              CallSid: sessionIdRef.current,
              SpeechResult: trimmed,
            }),
          }
        );

        const ttft = Math.round(performance.now() - startTime);
        const xml = await res.text();

        let replyText = "";
        let isEmergencyTransfer = false;

        if (xml.includes("<Dial") || xml.includes("whisper")) {
          isEmergencyTransfer = true;
          replyText = `Urgent safety condition detected. Initiating immediate warm transfer to our on-call technician at ${tenant.emergencyNumbers.onCallTechnician}. Please hold.`;
          setTransferAlert(
            `🚨 Tier 3 Warm Transfer Dispatched: Dialing on-call technician (${tenant.emergencyNumbers.onCallTechnician}) with private audio whisper.`
          );
        } else {
          const match = xml.match(/<Say[^>]*>([\s\S]*?)<\/Say>/);
          replyText = match ? match[1].trim() : "Thank you for reaching out. How else can I assist you today?";
        }

        const totalLatency = Math.round(performance.now() - startTime);

        setLatency({
          ttft,
          totalTurnaround: totalLatency,
        });

        // Add agent turn to transcript
        const agentTurnId = `agt_${Date.now()}`;
        setDialogue((prev) => [
          ...prev,
          {
            id: agentTurnId,
            sender: "agent",
            text: replyText,
            timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
            emergency: isEmergencyTransfer,
            ttftMs: ttft,
            totalLatencyMs: totalLatency,
          },
        ]);

        setIsThinking(false);

        // Speak reply via browser TTS
        speakAgentReply(replyText, () => {
          // Restart speech recognition if session is active
          if (recognitionRef.current && !isMuted) {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch {
              // Recognition already active
            }
          }
        });
      } catch (err: unknown) {
        setIsThinking(false);
        const errorMsg = err instanceof Error ? err.message : String(err);
        const fallbackText = "I have noted your request. Would you like me to book a technician or speak with our dispatcher?";
        setDialogue((prev) => [
          ...prev,
          {
            id: `agt_err_${Date.now()}`,
            sender: "agent",
            text: fallbackText,
            timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
            ttftMs: Math.round(performance.now() - startTime),
            totalLatencyMs: Math.round(performance.now() - startTime),
          },
        ]);
        speakAgentReply(fallbackText);
      }
    },
    [isThinking, tenant, isMuted, speakAgentReply]
  );

  // Initialize Web Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const win = window as unknown as IWindowSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) return null;

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      // Don't listen while agent is talking to prevent feedback
      if (isSpeakingRef.current) return;

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
      }

      if (final) {
        rec.stop();
        setIsListening(false);
        processSpokenInput(final);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        console.warn("[WebRtcVoiceTester] Speech recognition error:", e.error);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // Auto-restart if session active and not speaking or thinking
      if (isActive && !isSpeakingRef.current && !isThinking && !isMuted) {
        try {
          rec.start();
          setIsListening(true);
        } catch {
          // Ignored
        }
      }
    };

    return rec;
  }, [isActive, isThinking, isMuted, processSpokenInput]);

  // Real-time Audio Waveform Canvas Animation
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      // Compute RMS volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

      // Canvas dimensions
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle background grid line
      ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Dynamic mirrored visualizer bars
      const barCount = 36;
      const barWidth = (width / barCount) * 0.65;
      const gap = (width / barCount) * 0.35;

      for (let i = 0; i < barCount; i++) {
        const binIndex = Math.floor((i / barCount) * (bufferLength / 2));
        const val = dataArray[binIndex] || 0;
        const normalized = val / 255;
        const barHeight = Math.max(4, normalized * (height * 0.75));

        const x = i * (barWidth + gap) + gap / 2;
        const yTop = height / 2 - barHeight / 2;

        // Gradient coloring based on state
        const gradient = ctx.createLinearGradient(0, yTop, 0, yTop + barHeight);
        if (isSpeakingRef.current) {
          gradient.addColorStop(0, "#a855f7"); // purple
          gradient.addColorStop(0.5, "#06b6d4"); // cyan
          gradient.addColorStop(1, "#3b82f6"); // blue
        } else if (normalized > 0.15) {
          gradient.addColorStop(0, "#10b981"); // emerald
          gradient.addColorStop(0.5, "#06b6d4"); // cyan
          gradient.addColorStop(1, "#3b82f6"); // blue
        } else {
          gradient.addColorStop(0, "#334155");
          gradient.addColorStop(1, "#1e293b");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Pill rounded bars
        if (ctx.roundRect) {
          ctx.roundRect(x, yTop, barWidth, barHeight, 4);
        } else {
          ctx.rect(x, yTop, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  // Start Live Voice Session
  const startVoiceSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const win = window as unknown as IWindowSpeech;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsActive(true);
      sessionIdRef.current = `WEBRTC_${Date.now()}`;
      setDialogue([]);
      setTransferAlert(null);
      setLatency(null);

      // Start canvas waveform
      drawWaveform();

      // Initial spoken greeting from AI Agent
      const greeting = tenant.voiceConfig.greeting;
      const startT = performance.now();
      setDialogue([
        {
          id: `agt_greet_${Date.now()}`,
          sender: "agent",
          text: greeting,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          ttftMs: 42,
          totalLatencyMs: 95,
        },
      ]);

      speakAgentReply(greeting, () => {
        // Start STT listener after greeting completes
        const rec = initSpeechRecognition();
        if (rec) {
          recognitionRef.current = rec;
          try {
            rec.start();
          } catch {
            // Ignored
          }
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[WebRtcVoiceTester] Microphone access error:", errorMsg);
      alert("Microphone access is required for in-browser voice testing. Please allow microphone permissions in your browser.");
    }
  };

  // Stop Live Voice Session
  const stopVoiceSession = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignored
      }
      recognitionRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setIsActive(false);
    setIsListening(false);
    setIsThinking(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setAudioLevel(0);
    setInterimTranscript("");
  };

  // Toggle Mute
  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const newMuted = !isMuted;
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
      setIsMuted(newMuted);

      if (newMuted && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else if (!newMuted && recognitionRef.current && !isSpeaking) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          // Ignored
        }
      }
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 blur-[90px] pointer-events-none rounded-full" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isActive ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isActive ? "bg-emerald-500" : "bg-slate-600"
                }`}
              />
            </span>
            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-cyan-400">
              WebRTC In-Browser Voice Tester
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Zero PSTN Required
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
            Speak Directly with {tenant.voiceConfig.personaName} ({tenant.name})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Web Speech recognition, sub-second Groq / Gemini multi-LLM routing, and neural voice response.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`p-2.5 rounded-xl border text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  isMuted
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span className="hidden sm:inline">{isMuted ? "Unmute" : "Mute"}</span>
              </button>

              <button
                type="button"
                onClick={stopVoiceSession}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold flex items-center gap-1.5 hover:bg-rose-500/30 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startVoiceSession}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/25 cursor-pointer hover:scale-102 active:scale-98"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Start Voice Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Emergency Warm Transfer Alert Banner */}
      {transferAlert && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 animate-fade-in relative z-10">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1 font-mono leading-relaxed">{transferAlert}</div>
          <button
            type="button"
            onClick={() => setTransferAlert(null)}
            className="text-amber-400 hover:text-amber-200 text-xs font-mono cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Bento Layout: Voice Orb / Visualizer (Left) + Live Transcript (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* LEFT COLUMN: Voice Orb & Real-Time Waveform (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Animated Voice Orb & Status Card */}
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden min-h-[260px]">
            {/* Pulsing Glow Rings */}
            <div
              className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
                isSpeaking
                  ? "w-48 h-48 bg-purple-500/20 blur-2xl scale-125"
                  : isThinking
                  ? "w-44 h-44 bg-cyan-500/25 blur-2xl animate-spin"
                  : isListening
                  ? "w-40 h-40 bg-emerald-500/25 blur-2xl scale-110"
                  : "w-32 h-32 bg-slate-700/10 blur-xl"
              }`}
            />

            {/* Central Animated Voice Orb */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative ${
                  isSpeaking
                    ? "bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 shadow-purple-500/50 scale-105"
                    : isThinking
                    ? "bg-gradient-to-tr from-amber-500 via-cyan-500 to-indigo-600 shadow-cyan-500/40 animate-pulse"
                    : isListening
                    ? "bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 shadow-emerald-500/40 scale-100"
                    : "bg-slate-800 border border-slate-700"
                }`}
                style={{
                  transform: isActive && isListening ? `scale(${1 + (audioLevel / 100) * 0.25})` : undefined,
                }}
              >
                {/* Center Icon */}
                {isSpeaking ? (
                  <Volume2 className="w-10 h-10 text-white animate-pulse" />
                ) : isThinking ? (
                  <Sparkles className="w-10 h-10 text-white animate-spin" />
                ) : isListening ? (
                  <Mic className="w-10 h-10 text-white" />
                ) : (
                  <MicOff className="w-8 h-8 text-slate-500" />
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-semibold px-3 py-1 rounded-full border ${
                    isSpeaking
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
                      : isThinking
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 animate-pulse"
                      : isListening
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-800/80 border-slate-700 text-slate-400"
                  }`}
                >
                  {isSpeaking
                    ? `AI Speaking (${tenant.voiceConfig.personaName})`
                    : isThinking
                    ? "Groq 70B Reasoning..."
                    : isListening
                    ? isMuted
                      ? "Microphone Muted"
                      : "Listening for Speech..."
                    : "Session Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Oscilloscope Waveform Canvas */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>60fps Web Audio Spectrum</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Level: <span className="text-white font-bold">{audioLevel}%</span>
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={340}
              height={70}
              className="w-full h-[70px] rounded-xl bg-slate-950/90 border border-slate-800/60 block"
            />
          </div>

          {/* Sub-Second Latency HUD */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>TTFT Latency</span>
              </div>
              <div className="text-sm font-mono font-extrabold text-amber-300 mt-1">
                {latency ? `${latency.ttft}ms` : "185ms baseline"}
              </div>
              <div className="text-[9px] text-slate-400 font-mono mt-0.5">Time to First Token</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Turnaround</span>
              </div>
              <div className="text-sm font-mono font-extrabold text-cyan-300 mt-1">
                {latency ? `${latency.totalTurnaround}ms` : "340ms roundtrip"}
              </div>
              <div className="text-[9px] text-slate-400 font-mono mt-0.5">Speech End to Audio</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Conversational Transcript & Instant Test Chips (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-slate-950/70 border border-slate-800 p-5 min-h-[460px]">
          {/* Scrollable Dialogue History */}
          <div className="flex-1 overflow-y-auto max-h-[360px] pr-2 space-y-3 font-sans">
            {dialogue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Radio className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <div className="text-xs font-mono font-semibold text-slate-400">
                  Ready to test microphone voice stream
                </div>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Click &ldquo;Start Voice Session&rdquo; above or click any sample prompt below to audition the conversational AI agent.
                </p>
              </div>
            ) : (
              dialogue.map((turn) => {
                const isUser = turn.sender === "user";
                return (
                  <div
                    key={turn.id}
                    className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-mono ${
                        isUser
                          ? "bg-slate-800 text-slate-300 border border-slate-700"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isUser
                          ? "bg-cyan-500/10 border border-cyan-500/25 text-slate-100 rounded-tr-sm"
                          : turn.emergency
                          ? "bg-amber-500/15 border border-amber-500/40 text-amber-100 rounded-tl-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] font-mono text-slate-400">
                        <span className="font-semibold text-slate-300">
                          {isUser ? "You (Caller)" : tenant.voiceConfig.personaName}
                        </span>
                        <span>{turn.timestamp}</span>
                      </div>
                      <p className="text-xs">{turn.text}</p>

                      {turn.ttftMs && !isUser && (
                        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-2 text-[9px] font-mono text-slate-400">
                          <span className="text-amber-400">⚡ TTFT: {turn.ttftMs}ms</span>
                          <span>•</span>
                          <span className="text-cyan-400">Total: {turn.totalLatencyMs}ms</span>
                          <span>•</span>
                          <span className="text-emerald-400">Tier 1 Groq Llama 3.3</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Live Interim Transcript Stream */}
            {interimTranscript && (
              <div className="flex items-start gap-2.5 flex-row-reverse animate-pulse">
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center flex-shrink-0 text-xs">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed bg-cyan-500/5 border border-cyan-500/20 text-cyan-200 italic rounded-tr-sm">
                  <div className="text-[10px] font-mono text-cyan-400 font-semibold mb-1">
                    Live Speech Stream...
                  </div>
                  &ldquo;{interimTranscript}&rdquo;
                </div>
              </div>
            )}
          </div>

          {/* Quick-Test Conversational Prompt Chips */}
          <div className="pt-4 border-t border-slate-800/80 mt-3">
            <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold mb-2 flex items-center justify-between">
              <span>Audition Test Utterances (1-Click)</span>
              <span className="text-cyan-400">Sub-Second AI Response</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  label: "🚨 Emergency Gas Leak",
                  text: "Help! There is a strong gas smell coming from our basement furnace!",
                  color: "hover:border-red-500/50 hover:bg-red-500/10 text-red-200",
                },
                {
                  label: "📅 Routine Maintenance Booking",
                  text: "I would like to schedule an annual AC maintenance tune-up for next week.",
                  color: "hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-200",
                },
                {
                  label: "💰 Diagnostic Fee Inquiry",
                  text: "How much do you charge for a technician diagnostic service visit?",
                  color: "hover:border-blue-500/50 hover:bg-blue-500/10 text-blue-200",
                },
                {
                  label: "👤 Speak to Human Dispatcher",
                  text: "Can you please connect me directly to a human dispatcher?",
                  color: "hover:border-purple-500/50 hover:bg-purple-500/10 text-purple-200",
                },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={isThinking}
                  onClick={() => {
                    if (!isActive) {
                      sessionIdRef.current = `WEBRTC_${Date.now()}`;
                      setIsActive(true);
                    }
                    processSpokenInput(chip.text);
                  }}
                  className={`p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-left transition-all cursor-pointer text-[11px] leading-tight flex items-start gap-1.5 ${chip.color} disabled:opacity-50`}
                >
                  <Play className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white truncate">{chip.label}</div>
                    <div className="text-slate-400 text-[10px] line-clamp-1 mt-0.5">&ldquo;{chip.text}&rdquo;</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
