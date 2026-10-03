"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PhoneCall,
  Activity,
  Layers,
  Sparkles,
  Bot,
  ExternalLink,
  Mic,
  Phone,
} from "lucide-react";
import { TelemetryStats } from "@/components/voice/TelemetryStats";
import { CallSimulator } from "@/components/voice/CallSimulator";
import { WebRtcVoiceTester } from "@/components/voice/WebRtcVoiceTester";
import {
  getAllTenants,
  APEX_HVAC_PROFILE,
  METRO_DENTAL_PROFILE,
  PRECISION_PLUMBING_PROFILE,
  OAKWOOD_LEGAL_PROFILE,
} from "@/lib/telephony/tenant-store";
import { TenantProfile } from "@/lib/telephony/types";

export default function VoiceAgentMissionControlPage() {
  const [selectedTenant, setSelectedTenant] = useState<TenantProfile>(APEX_HVAC_PROFILE);
  const [testerMode, setTesterMode] = useState<"webrtc" | "pstn">("webrtc");
  const tenants = getAllTenants();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Background Radial Glow Accents */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {/* Navigation & Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors mb-2 group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to VaniEdge Platform</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>VaniEdge-Pro Telephony</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    v2.0 Enterprise
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Sub-second conversational AI voice receptionist with 4-tier zero-drop failover protocol.
                </p>
              </div>
            </div>
          </div>

          {/* Live Twilio Line Badge */}
          <div className="flex items-center gap-2">
            <a
              href="tel:+18149613703"
              className="px-4 py-2 rounded-2xl bg-slate-900 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs font-mono font-medium flex items-center gap-2 transition-all hover:bg-amber-500/10 shadow-lg shadow-amber-500/10"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Live Line: +1 (814) 961-3703</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>
        </div>

        {/* 1. Real-time Telemetry Stats */}
        <div className="mb-8">
          <TelemetryStats />
        </div>

        {/* 2. Multi-Tenant Industry Selector */}
        <div className="mb-8">
          <div className="text-xs uppercase font-mono text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select Multi-Tenant Business Profile</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { profile: APEX_HVAC_PROFILE, badge: "HVAC & Heating", color: "border-cyan-500" },
              { profile: METRO_DENTAL_PROFILE, badge: "Urgent Dental", color: "border-teal-500" },
              { profile: PRECISION_PLUMBING_PROFILE, badge: "Plumbing Pros", color: "border-blue-500" },
              { profile: OAKWOOD_LEGAL_PROFILE, badge: "Legal Defense", color: "border-purple-500" },
            ].map(({ profile, badge }) => {
              const isSelected = selectedTenant.id === profile.id;
              return (
                <button
                  key={profile.id}
                  onClick={() => setSelectedTenant(profile)}
                  className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 border-cyan-400/80 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/30"
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-cyan-400">
                      {badge}
                    </span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                  </div>
                  <div className="text-xs font-bold text-white truncate">{profile.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span>Voice: {profile.voiceConfig.personaName}</span>
                    <span>•</span>
                    <span>{profile.voiceConfig.pollyVoice.split(".")[1]?.split("-")[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. In-Browser Telephony Testing Studio */}
        <div className="mb-10">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="inline-flex p-1 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setTesterMode("webrtc")}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  testerMode === "webrtc"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>🎙️ Live Microphone WebRTC Tester</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 font-bold">
                  NEW
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTesterMode("pstn")}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  testerMode === "pstn"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>📞 PSTN Phone & DTMF Simulator</span>
              </button>
            </div>

            <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Multi-LLM Engine: Groq Llama 3.3 70B & Gemini Flash</span>
            </div>
          </div>

          {/* Active Tester Component */}
          {testerMode === "webrtc" ? (
            <WebRtcVoiceTester tenant={selectedTenant} />
          ) : (
            <CallSimulator tenant={selectedTenant} />
          )}
        </div>

        {/* 4. Architecture & 4-Tier Zero-Drop Protocol Explainer */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">
              The &quot;Omni-Shield&quot; 4-Tier Zero-Drop Architecture
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-3xl">
            99.9% of voice bot implementations fail due to latency spikes, audio packet loss, or caller dropoffs.
            Our platform guarantees that no client call is ever lost through an active 4-tier resilience cascade:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs font-mono text-cyan-400 font-semibold mb-1">Tier 1: Sub-Second AI</div>
              <div className="text-sm font-bold text-white mb-2">Interactive Voice</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Groq Llama 3.3 70B (67ms) + Amazon Polly Neural voice streaming with natural conversational turn-taking.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs font-mono text-indigo-400 font-semibold mb-1">Tier 2: Circuit Breaker</div>
              <div className="text-sm font-bold text-white mb-2">Voicemail Fallback</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                If upstream speech/LLM exceeds 1,400ms, seamlessly intercepts call into voicemail recording without dropping.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs font-mono text-amber-400 font-semibold mb-1">Tier 3: Warm Transfer</div>
              <div className="text-sm font-bold text-white mb-2">Private Whisper</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sub-1ms negation-aware triage routes gas leaks and emergencies directly to technician cell with private whisper.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs font-mono text-emerald-400 font-semibold mb-1">Tier 4: Omnichannel</div>
              <div className="text-sm font-bold text-white mb-2">Sub-3s SMS Rescue</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                If caller hangs up in &lt;15 seconds, automatically fires an idempotent SMS with instant online booking link.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Attribution */}
        <div className="mt-12 text-center text-xs text-slate-500 font-mono">
          VaniEdge-Pro Telephony Platform • Built by Samarth Nimangre (SAM CODES) • Bridge Builders AI LLC
        </div>
      </div>
    </div>
  );
}
