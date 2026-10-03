"use client";

import React, { useState, useRef, useEffect } from "react";
import { Phone, PhoneOff, Mic, Send, Volume2, ShieldAlert, MessageSquare, RefreshCw } from "lucide-react";
import { TenantProfile } from "@/lib/telephony/types";

// Standard telephone DTMF keypad frequencies
const DTMF_FREQS: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

interface CallSimulatorProps {
  tenant: TenantProfile;
}

interface EventLog {
  id: string;
  time: string;
  type: "inbound" | "speech" | "agent" | "transfer" | "failover" | "sms";
  message: string;
}

export function CallSimulator({ tenant }: CallSimulatorProps) {
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connected" | "transferring" | "ended">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [callSid, setCallSid] = useState("");
  const [events, setEvents] = useState<EventLog[]>([]);
  const [lastAgentReply, setLastAgentReply] = useState("");
  const [smsNotification, setSmsNotification] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Web Audio Context on first interaction
  const getAudioContext = () => {
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    return audioCtxRef.current;
  };

  // Play standard telephone DTMF dual-tone
  const playDTMFTone = (key: string) => {
    const freqs = DTMF_FREQS[key];
    if (!freqs) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];

    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
  };

  // Speak agent reply in browser using native SpeechSynthesis
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const addEvent = (type: EventLog["type"], message: string) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    setEvents((prev) => [{ id: Math.random().toString(), time: timeStr, type, message }, ...prev]);
  };

  // Track call duration timer
  useEffect(() => {
    if (callActive) {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callActive]);

  // Start call simulation
  const handleStartCall = async () => {
    setCallStatus("dialing");
    setCallActive(true);
    setSmsNotification(null);
    const newSid = `CA_SIM_${Date.now()}`;
    setCallSid(newSid);

    addEvent("inbound", `Dialing ${tenant.name} (${tenant.phone}) from +1-555-234-5678...`);

    try {
      const res = await fetch("/api/voice/incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          CallSid: newSid,
          From: "+15552345678",
          To: tenant.phone,
          Direction: "inbound",
        }),
      });

      setCallStatus("connected");
      addEvent("inbound", `Connected (HTTP ${res.status}). Initial TwiML delivered.`);

      // Extract spoken greeting
      const greeting = tenant.voiceConfig.greeting;
      setLastAgentReply(greeting);
      addEvent("agent", `${tenant.voiceConfig.personaName}: "${greeting}"`);
      speakText(greeting);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addEvent("failover", `Connection error: ${msg}`);
      setCallStatus("ended");
      setCallActive(false);
    }
  };

  // End call or simulate hangup
  const handleEndCall = async (isAbruptDrop = false) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setCallActive(false);
    setCallStatus("ended");

    const duration = isAbruptDrop ? 6 : callDuration;
    addEvent("inbound", `Call terminated. Duration: ${duration}s.`);

    try {
      const res = await fetch("/api/voice/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          CallSid: callSid,
          CallStatus: "completed",
          CallDuration: String(duration),
        }),
      });

      const data = (await res.json()) as { rescueTriggered?: boolean };
      if (data.rescueTriggered) {
        setSmsNotification(tenant.smsRescueTemplate);
        addEvent("sms", `🚨 [Tier 4 Rescue Dispatched]: "${tenant.smsRescueTemplate}"`);
      }
    } catch {
      // ignore
    }
  };

  // Send spoken or typed utterance to agent
  const handleSendUtterance = async (speechText: string) => {
    if (!speechText.trim() || !callActive || isProcessing) return;
    setIsProcessing(true);
    setUserInput("");

    addEvent("speech", `Caller: "${speechText}"`);

    const startT = performance.now();
    try {
      const res = await fetch(`/api/voice/process?callSid=${encodeURIComponent(callSid)}&tenantId=${encodeURIComponent(tenant.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          CallSid: callSid,
          SpeechResult: speechText,
        }),
      });

      const xml = await res.text();
      const elapsed = Math.round(performance.now() - startT);

      // Check if response contains Warm Transfer Dial
      if (xml.includes("<Dial") || xml.includes("whisper")) {
        setCallStatus("transferring");
        const reply = `Urgent condition detected. Warm-transferring to on-call technician (${tenant.emergencyNumbers.onCallTechnician}).`;
        setLastAgentReply(reply);
        addEvent("transfer", `🚨 [Tier 3 Warm Transfer] (${elapsed}ms): Dialing technician with private whisper.`);
        speakText(reply);
      } else {
        // Extract <Say> text
        const match = xml.match(/<Say[^>]*>([\s\S]*?)<\/Say>/);
        const replyText = match ? match[1] : "How else can I assist you today?";
        setLastAgentReply(replyText);
        addEvent("agent", `${tenant.voiceConfig.personaName} (${elapsed}ms): "${replyText}"`);
        speakText(replyText);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addEvent("failover", `Process error (${msg}). Circuit breaker tripped.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Phone Simulator & Dialpad (5 cols) */}
      <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl flex flex-col justify-between shadow-2xl relative overflow-hidden">
        {/* Top Status Screen */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div>
              <div className="text-xs uppercase font-mono text-cyan-400 font-semibold tracking-wider">
                {tenant.name}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">{tenant.phone}</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  callStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : callStatus === "transferring"
                    ? "bg-amber-500 animate-ping"
                    : callStatus === "dialing"
                    ? "bg-cyan-500 animate-pulse"
                    : "bg-slate-600"
                }`}
              />
              <span className="text-xs font-mono text-slate-300 uppercase">
                {callStatus === "connected"
                  ? `Active ${formatSeconds(callDuration)}`
                  : callStatus}
              </span>
            </div>
          </div>

          {/* Agent Spoken Bubble */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 min-h-[90px] flex items-center justify-center text-center relative overflow-hidden">
            {callActive ? (
              <div>
                <Volume2 className="w-4 h-4 text-cyan-400 mx-auto mb-1 animate-bounce" />
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {lastAgentReply || "Connecting..."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono">
                Click &quot;Start Call&quot; to test AI voice agent in real-time.
              </p>
            )}
          </div>

          {/* SMS Rescue Banner if Triggered */}
          {smsNotification && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2 animate-fade-in">
              <MessageSquare className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-400">Tier 4 SMS Rescue Received:</span>
                <p className="text-[11px] text-slate-300 mt-0.5">{smsNotification}</p>
              </div>
            </div>
          )}
        </div>

        {/* Middle: 3x4 DTMF Dialpad */}
        <div className="my-6">
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
              <button
                key={key}
                onClick={() => {
                  playDTMFTone(key);
                  if (callActive) {
                    handleSendUtterance(key);
                  }
                }}
                className="w-16 h-12 rounded-xl bg-slate-800/80 hover:bg-cyan-500/20 active:scale-95 border border-slate-700/60 hover:border-cyan-500/50 text-white font-mono text-base font-semibold flex flex-col items-center justify-center transition-all shadow-sm"
              >
                <span>{key}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="space-y-3">
          {!callActive ? (
            <button
              onClick={handleStartCall}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Start Inbound Voice Call</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleEndCall(false)}
                className="py-3 px-4 rounded-xl bg-rose-600/80 hover:bg-rose-500 active:scale-95 text-white font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
              <button
                onClick={() => handleEndCall(true)}
                className="py-3 px-4 rounded-xl bg-amber-600/80 hover:bg-amber-500 active:scale-95 text-white font-medium flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Simulate Drop (&lt;10s)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Interactive Utterance Generator & Live Telephony Stream (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {/* Quick Test Prompt Badges */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl">
          <div className="text-xs uppercase font-mono text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive Spoken Test Scenarios</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              disabled={!callActive || isProcessing}
              onClick={() => handleSendUtterance("Help, my furnace smells like a gas leak and water is pouring!")}
              className="p-3 text-left rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="font-semibold flex items-center gap-1 text-rose-400 mb-0.5">
                <span>🚨 Emergency Leak</span>
                <span className="text-[10px] font-mono opacity-60">(&lt;1ms warm transfer)</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-1 group-hover:line-clamp-none">
                &quot;Help, my furnace smells like a gas leak and water is pouring!&quot;
              </p>
            </button>

            <button
              disabled={!callActive || isProcessing}
              onClick={() => handleSendUtterance("I would like to schedule an annual heating safety tune-up.")}
              className="p-3 text-left rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="font-semibold flex items-center gap-1 text-cyan-400 mb-0.5">
                <span>📅 Routine Booking</span>
                <span className="text-[10px] font-mono opacity-60">(Cal.com flow)</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-1 group-hover:line-clamp-none">
                &quot;I would like to schedule an annual heating safety tune-up.&quot;
              </p>
            </button>

            <button
              disabled={!callActive || isProcessing}
              onClick={() => handleSendUtterance("How much do you charge for a diagnostic inspection?")}
              className="p-3 text-left rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="font-semibold flex items-center gap-1 text-indigo-400 mb-0.5">
                <span>💰 Pricing Policy FAQ</span>
                <span className="text-[10px] font-mono opacity-60">($89 fee waived)</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-1 group-hover:line-clamp-none">
                &quot;How much do you charge for a diagnostic inspection?&quot;
              </p>
            </button>

            <button
              disabled={!callActive || isProcessing}
              onClick={() => handleSendUtterance("Can I please speak with a human dispatcher?")}
              className="p-3 text-left rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="font-semibold flex items-center gap-1 text-amber-400 mb-0.5">
                <span>👤 Human Dispatcher</span>
                <span className="text-[10px] font-mono opacity-60">(Warm transfer)</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-1 group-hover:line-clamp-none">
                &quot;Can I please speak with a human dispatcher?&quot;
              </p>
            </button>
          </div>

          {/* Custom Typed Speech Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendUtterance(userInput);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={!callActive || isProcessing}
              placeholder={callActive ? "Type custom speech or click a preset scenario above..." : "Start call to speak..."}
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 disabled:opacity-50 font-mono"
            />
            <button
              type="submit"
              disabled={!callActive || !userInput.trim() || isProcessing}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-medium text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send Speech</span>
            </button>
          </form>
        </div>

        {/* Real-time Telemetry Event Stream */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl flex-1 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className="text-xs uppercase font-mono text-slate-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Live Telemetry &amp; Event Stream
            </span>
            <button
              onClick={() => setEvents([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-mono"
            >
              Clear Log
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[260px] font-mono text-xs pr-1">
            {events.length === 0 ? (
              <p className="text-slate-600 text-center py-8">
                No active events. Start a call to observe state transitions.
              </p>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                    ev.type === "agent"
                      ? "bg-cyan-950/30 border-cyan-800/40 text-cyan-200"
                      : ev.type === "speech"
                      ? "bg-slate-800/40 border-slate-700/50 text-slate-200"
                      : ev.type === "transfer"
                      ? "bg-rose-950/40 border-rose-800/50 text-rose-200"
                      : ev.type === "sms"
                      ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-200"
                      : "bg-slate-950/50 border-slate-800 text-slate-400"
                  }`}
                >
                  <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{ev.time}</span>
                  <div className="flex-1 break-words">{ev.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
