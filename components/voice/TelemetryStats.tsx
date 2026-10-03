"use client";

import React from "react";
import { Activity, ShieldCheck, Zap, PhoneCall } from "lucide-react";

export function TelemetryStats({ activeCallsCount = 1 }: { activeCallsCount?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Metric 1 */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Fast Turn Latency</span>
          <Zap className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1">
          <span>67</span>
          <span className="text-xs font-normal text-cyan-400">ms TTFT</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Powered by Groq Cloud &amp; Gemini 3.5
        </div>
      </div>

      {/* Metric 2 */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Zero-Drop Rescue</span>
          <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400 flex items-baseline gap-1">
          <span>100%</span>
          <span className="text-xs font-normal text-slate-400">recovery</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Sub-3s SMS &amp; Email failover cascade
        </div>
      </div>

      {/* Metric 3 */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Emergency Triage</span>
          <Activity className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1">
          <span>&lt; 1</span>
          <span className="text-xs font-normal text-indigo-400">ms Regex</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Sub-millisecond negation-aware gate
        </div>
      </div>

      {/* Metric 4 */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Live PSTN Line</span>
          <PhoneCall className="w-4 h-4 text-amber-400 animate-pulse" />
        </div>
        <div className="text-lg font-bold font-mono text-amber-400 truncate">
          +1 (814) 961-3703
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Active Twilio Telecom</span>
        </div>
      </div>
    </div>
  );
}
