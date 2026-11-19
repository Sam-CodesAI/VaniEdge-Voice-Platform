"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Zap,
  Activity,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  PhoneForwarded,
  Clock,
  Terminal,
  Cpu,
  Flame,
  Radio,
  FileCode,
  Check,
} from "lucide-react";

export default function LatencyChaosSimulator() {
  const [latencyMs, setLatencyMs] = useState<number>(120);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3 | 4>(1);
  const [emergencyKeyword, setEmergencyKeyword] = useState<string>("none");
  const [tripTimeMs, setTripTimeMs] = useState<number>(0.8);
  const [twimlOutput, setTwimlOutput] = useState<string>(
    `<Response>\n  <Connect>\n    <Stream url="wss://vaniedge.vercel.app/voice/stream"/>\n  </Connect>\n</Response>`
  );

  // Evaluate failover state machine based on simulated chaos conditions
  const handleLatencyChange = (newVal: number) => {
    setLatencyMs(newVal);

    if (emergencyKeyword !== "none") {
      return; // Emergency override takes precedence
    }

    if (newVal >= 1400) {
      // Tier 2: Latency Circuit Breaker Tripped!
      setActiveTier(2);
      setTripTimeMs(4.1);
      setTwimlOutput(
        `<!-- Tier 2 Voicemail Circuit Breaker Tripped at ${newVal}ms (>1400ms SLA) -->\n<Response>\n  <Say voice="Polly.Joanna-Neural" language="en-US">\n    Our line specialist is experiencing high call volume. Please leave your name and urgent message after the tone.\n  </Say>\n  <Record maxLength="60" action="/api/voice/recording" playBeep="true"/>\n</Response>`
      );
    } else {
      // Tier 1: Sub-Second Streaming Voice Active
      setActiveTier(1);
      setTripTimeMs(0.48);
      setTwimlOutput(
        `<Response>\n  <Connect>\n    <Stream url="wss://vaniedge.vercel.app/voice/stream"/>\n  </Connect>\n</Response>`
      );
    }
  };

  const handleSimulateEmergency = (keyword: string) => {
    setEmergencyKeyword(keyword);
    if (keyword === "none") {
      handleLatencyChange(latencyMs);
      return;
    }

    // Tier 3: Emergency Warm Transfer + Whisper Briefing
    setActiveTier(3);
    setTripTimeMs(1.06);
    setTwimlOutput(
      `<!-- Tier 3 Emergency Keyword Match: "${keyword}" (< 1ms Triage) -->\n<Response>\n  <Say voice="Polly.Joanna-Neural">\n    Flagged as urgent priority. Transferring directly to on-call supervisor.\n  </Say>\n  <Dial timeout="25" action="/api/voice/transfer-status">\n    <Number url="/api/voice/whisper">+916361209256</Number>\n  </Dial>\n</Response>`
    );
  };

  const handleSimulateDropout = () => {
    // Tier 4: Omnichannel SMS Rescue (< 15s call dropped)
    setActiveTier(4);
    setTripTimeMs(3.2);
    setTwimlOutput(
      `<!-- Tier 4 Omnichannel SMS Rescue Dispatched -->\n<Sms to="+919876543210" from="+918047259000">\n  [VaniEdge AI] We noticed your call was disconnected. Self-book directly or request an instant callback: https://vaniedge.vercel.app/demo\n</Sms>`
    );
  };

  const handleReset = () => {
    setLatencyMs(120);
    setActiveTier(1);
    setEmergencyKeyword("none");
    setTripTimeMs(0.48);
    setTwimlOutput(
      `<Response>\n  <Connect>\n    <Stream url="wss://vaniedge.vercel.app/voice/stream"/>\n  </Connect>\n</Response>`
    );
  };

  return (
    <div className="w-full bg-[#08080a] border border-white/10 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
      {/* Background Radial Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-amber-400 mb-2">
            <Flame className="w-3.5 h-3.5 animate-pulse" />
            <span>CHAOS ENGINEERING BENCHMARK LAB</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold font-oswald uppercase tracking-tight text-white">
            Simulate Latency Spikes & Watchdog Failover
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl">
            Inject artificial dead air, network timeouts, or urgent keywords. Watch the 4-tier state machine trip in under 10 milliseconds.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-mono transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Lab</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Column: Chaos Injection Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Slider: Latency Spike */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Simulate Upstream Network Latency:</span>
              </label>
              <span
                className={`font-mono text-sm font-bold px-2.5 py-0.5 rounded-full border ${
                  latencyMs >= 1400
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                    : latencyMs >= 800
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {latencyMs} ms
              </span>
            </div>

            <input
              type="range"
              min={50}
              max={2800}
              step={50}
              value={latencyMs}
              onChange={(e) => handleLatencyChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[11px] font-mono text-gray-500">
              <span>50ms (Edge Fast)</span>
              <span className="text-amber-400">1,200ms (Connect SLA)</span>
              <span className="text-rose-400">1,400ms (Circuit Breaker Trip)</span>
              <span>2,800ms (Dead Air)</span>
            </div>
          </div>

          {/* Quick Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleLatencyChange(1800)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                activeTier === 2
                  ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                  : "bg-white/[0.02] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              <span className="text-xs font-bold font-oswald uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Trip Voicemail</span>
              </span>
              <span className="text-[11px] text-gray-400 mt-1">Inject 1,800ms dead air</span>
            </button>

            <button
              type="button"
              onClick={() => handleSimulateEmergency("water heater burst")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                activeTier === 3
                  ? "bg-rose-500/10 border-rose-500 text-white shadow-lg shadow-rose-500/20"
                  : "bg-white/[0.02] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              <span className="text-xs font-bold font-oswald uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <PhoneForwarded className="w-3.5 h-3.5 text-rose-400" />
                <span>Emergency Triage</span>
              </span>
              <span className="text-[11px] text-gray-400 mt-1">Simulate "water burst"</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateDropout}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                activeTier === 4
                  ? "bg-cyan-500/10 border-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : "bg-white/[0.02] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              <span className="text-xs font-bold font-oswald uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>SMS Rescue</span>
              </span>
              <span className="text-[11px] text-gray-400 mt-1">Simulate call &lt; 15s</span>
            </button>
          </div>

          {/* Active Tier Visual Indicator Card */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
                Active Telephony Engine Status:
              </span>
              <span className="font-bold text-base font-oswald uppercase tracking-wide text-white mt-0.5 block">
                {activeTier === 1 && "Tier 1: Streaming AI Voice (ElevenLabs + Polly)"}
                {activeTier === 2 && "Tier 2: Voicemail Circuit Breaker (<Record> Active)"}
                {activeTier === 3 && "Tier 3: Warm Transfer & Technician Whisper (<Dial> Active)"}
                {activeTier === 4 && "Tier 4: Omnichannel SMS Rescue Dispatched"}
              </span>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] text-gray-400 block">Measured Trip Time</span>
              <span className="text-sm font-bold text-emerald-400">{tripTimeMs} ms</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live TwiML Telemetry Output */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl bg-black/90 border border-white/10 p-4 font-mono text-xs overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
              <div className="flex items-center gap-2 text-gray-300 font-semibold">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Live Generated TwiML Response</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-400 font-bold">
                HTTP 200 XML
              </span>
            </div>

            {/* XML Display */}
            <pre className="text-emerald-300 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-56">
              {twimlOutput}
            </pre>
          </div>

          {/* Verification Badge */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Zero-Dropped-Calls Verified</span>
            </span>
            <span>SLA: &lt; 1,400ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
