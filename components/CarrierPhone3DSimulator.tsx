"use client";

import React, { useState, useRef } from "react";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  Wifi,
  Radio,
  Battery,
  Volume2,
  RotateCcw,
} from "lucide-react";

interface CarrierPhone3DSimulatorProps {
  targetPhone?: string;
}

interface CarrierPreset {
  id: string;
  name: string;
  country: string;
  type: string;
  forwardCode: string;
  cancelCode: string;
  description: string;
}

const CARRIERS: CarrierPreset[] = [
  {
    id: "jio",
    name: "Reliance Jio",
    country: "India",
    type: "Top 4G/5G Carrier",
    forwardCode: "*409*",
    cancelCode: "*410",
    description: "Conditional forward when unanswered or busy. Dials *409* followed by target number.",
  },
  {
    id: "airtel",
    name: "Bharti Airtel",
    country: "India",
    type: "Enterprise Carrier",
    forwardCode: "*71*",
    cancelCode: "*70",
    description: "Conditional forward when line is busy or unanswered. Cancel anytime with *70.",
  },
  {
    id: "vi",
    name: "Vodafone Idea (Vi)",
    country: "India",
    type: "GSM Standard",
    forwardCode: "**61*",
    cancelCode: "##002#",
    description: "GSM 3GPP call forward rule when no answer. Cancel with ##002#.",
  },
  {
    id: "bsnl",
    name: "BSNL Mobile",
    country: "India",
    type: "National Telecom",
    forwardCode: "*21*",
    cancelCode: "##21#",
    description: "National public network unconditional forward.",
  },
  {
    id: "verizon",
    name: "Verizon Wireless",
    country: "USA",
    type: "US Nationwide",
    forwardCode: "*71",
    cancelCode: "*73",
    description: "No-answer call forward for North American lines.",
  },
  {
    id: "att",
    name: "AT&T Mobility",
    country: "USA",
    type: "US Nationwide",
    forwardCode: "*71",
    cancelCode: "*720",
    description: "Standard conditional transfer to voice AI receptionist.",
  },
];

// DTMF audio frequencies for realistic phone dial tones
const DTMF_TONES: Record<string, [number, number]> = {
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

export default function CarrierPhone3DSimulator({
  targetPhone = "+18149613703",
}: CarrierPhone3DSimulatorProps) {
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierPreset>(CARRIERS[0]);
  const [dialedInput, setDialedInput] = useState<string>("");
  const [callState, setCallState] = useState<"idle" | "dialing" | "forwarded" | "cancelled">("idle");
  const [copied, setCopied] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanTarget = targetPhone.replace(/\D/g, "");
  const fullDialString = `${selectedCarrier.forwardCode}${cleanTarget}#`;

  // Play realistic DTMF phone tone
  const playTone = (digit: string) => {
    if (typeof window === "undefined") return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const freqs = DTMF_TONES[digit];
      if (!freqs) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio autoplay permission guard
    }
  };

  const handleKeyPress = (char: string) => {
    playTone(char);
    if (callState !== "idle") setCallState("idle");
    setDialedInput((prev) => (prev.length < 20 ? prev + char : prev));
  };

  const handleBackspace = () => {
    setDialedInput((prev) => prev.slice(0, -1));
  };

  const handleApplyPreset = () => {
    setDialedInput(fullDialString);
    playTone("*");
  };

  const handleDial = () => {
    if (!dialedInput.trim()) {
      handleApplyPreset();
      return;
    }

    setCallState("dialing");
    playTone("#");

    setTimeout(() => {
      if (dialedInput.includes(selectedCarrier.cancelCode)) {
        setCallState("cancelled");
      } else {
        setCallState("forwarded");
      }
    }, 1200);
  };

  const handleReset = () => {
    setCallState("idle");
    setDialedInput("");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(fullDialString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-[#08080a] border border-white/10 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
      {/* Background Radial Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-emerald-400 mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>INTERACTIVE CARRIER FORWARDING SIMULATOR</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold font-oswald uppercase tracking-tight text-white">
            Forward Your Business Calls in 10 Seconds
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
            Simulate your carrier forwarding code live. No hardware or SIP configuration required.
          </p>
        </div>

        {/* Copy Quick Action */}
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 text-xs font-mono text-white transition-all cursor-pointer hover:bg-white/10 shadow-sm"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
          <span>{copied ? "Copied Dial String" : `Copy: ${fullDialString}`}</span>
        </button>
      </div>

      {/* Grid: Carrier Selectors on Left, 3D Phone Bezel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Column: Carrier Selector Buttons & Step-by-Step */}
        <div className="lg:col-span-7 space-y-4">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-400">
            Select Your Mobile or Landline Carrier:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CARRIERS.map((c) => {
              const isSelected = selectedCarrier.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCarrier(c);
                    setCallState("idle");
                    setDialedInput(`${c.forwardCode}${cleanTarget}#`);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/15"
                      : "bg-[#0d0d12] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs sm:text-sm text-white font-oswald uppercase tracking-wide">
                      {c.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                      {c.country}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    {c.forwardCode}&lt;number&gt;
                  </span>
                </button>
              );
            })}
          </div>

          {/* Carrier Explanation Card */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{selectedCarrier.name} Protocol Details</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">{selectedCarrier.type}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              {selectedCarrier.description}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="text-emerald-400">
                Activate: <strong>{fullDialString}</strong>
              </span>
              <span className="text-gray-400">
                Cancel Anytime: <strong>{selectedCarrier.cancelCode}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleApplyPreset}
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold font-oswald uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Load Into Phone</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Dialpad</span>
            </button>
          </div>
        </div>

        {/* Right Column: 3D Smartphone Glass Mockup */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-[280px] sm:w-[310px] h-[560px] bg-[#0c0d12] border-4 border-slate-700/80 rounded-[44px] shadow-2xl p-4 flex flex-col justify-between relative overflow-hidden ring-1 ring-white/15">
            
            {/* Glossy Screen Glare */}
            <div className="absolute -top-20 -right-20 w-52 h-52 bg-white/[0.03] rounded-full blur-2xl pointer-events-none" />

            {/* Phone Top Notch / Speaker & Status Bar */}
            <div>
              <div className="flex justify-center mb-2">
                <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center gap-1.5 border border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                  <div className="w-8 h-1 rounded-full bg-slate-800" />
                </div>
              </div>

              {/* Status Header: Carrier, WiFi, Battery */}
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 px-3">
                <span className="font-semibold text-white">{selectedCarrier.name} 5G</span>
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <Battery className="w-3.5 h-3.5 text-gray-300" />
                </div>
              </div>
            </div>

            {/* Phone Screen Display Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 py-4">
              {callState === "forwarded" ? (
                <div className="text-center space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-white text-sm font-oswald uppercase tracking-wide">
                    Call Forwarding Enabled
                  </h4>
                  <p className="text-[11px] font-mono text-emerald-300">
                    Routing to {targetPhone}
                  </p>
                  <p className="text-[10px] text-gray-400 pt-1">
                    Your AI voice receptionist is now active for unanswered calls.
                  </p>
                </div>
              ) : callState === "cancelled" ? (
                <div className="text-center space-y-2 animate-in fade-in duration-300">
                  <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
                    <PhoneOff className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-white text-sm font-oswald uppercase tracking-wide">
                    Forwarding Cancelled
                  </h4>
                  <p className="text-[11px] font-mono text-gray-400">Normal ringing restored</p>
                </div>
              ) : callState === "dialing" ? (
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-cyan-500/20 border border-cyan-500 flex items-center justify-center text-cyan-400 animate-pulse">
                    <PhoneCall className="w-7 h-7" />
                  </div>
                  <p className="text-xs font-mono text-cyan-300 animate-pulse">
                    Executing Carrier MMI Code...
                  </p>
                  <p className="text-[13px] font-mono text-white font-bold">{dialedInput}</p>
                </div>
              ) : (
                <div className="w-full text-center">
                  <div className="min-h-[40px] flex items-center justify-center">
                    <span className="text-lg font-mono font-bold text-white tracking-widest break-all">
                      {dialedInput || <span className="text-gray-600 text-sm">Enter code or dial</span>}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-emerald-400 mt-1">
                    VaniEdge AI DID: {targetPhone}
                  </p>
                </div>
              )}
            </div>

            {/* Interactive Phone Keypad (3x4 Grid) */}
            <div className="space-y-2.5 pb-2">
              <div className="grid grid-cols-3 gap-2 px-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeyPress(k)}
                    className="h-11 rounded-2xl bg-white/[0.04] hover:bg-white/[0.1] active:bg-emerald-500/30 text-white font-bold text-base font-mono transition-all flex flex-col items-center justify-center border border-white/5 active:scale-95 cursor-pointer"
                  >
                    <span>{k}</span>
                  </button>
                ))}
              </div>

              {/* Call / Dial Bar with Backspace */}
              <div className="flex items-center justify-center gap-4 pt-1 px-4">
                <button
                  type="button"
                  onClick={handleDial}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-all cursor-pointer"
                  title="Dial Carrier Code"
                >
                  <Phone className="w-6 h-6 fill-black" />
                </button>

                {dialedInput.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="p-2 text-xs font-mono text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Home Indicator Bar */}
            <div className="flex justify-center pt-1">
              <div className="w-28 h-1 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
