import React from "react";
import { Bot, ArrowRight, Sliders, Zap, Server, ShieldCheck, Activity } from "lucide-react";

interface LandingHeroProps {
  onScrollToStudio: () => void;
  onOpenAuth: (mode: "signin" | "signup") => void;
  onOpenCustomizer?: () => void;
}

export default function LandingHero({
  onScrollToStudio,
  onOpenAuth,
  onOpenCustomizer,
}: LandingHeroProps) {
  return (
    <section className="relative w-full pt-32 pb-24 overflow-hidden bg-[#050505] selection:bg-emerald-500/30 font-sans">
      {/* 2026 Cinematic Dark-Mode Radial Gradients & Grain */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] rounded-full bg-cyan-600/10 blur-[140px] pointer-events-none" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        
        {/* Top Status Pill - Glowing */}
        <div className="mb-8 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:bg-white/[0.05] transition-all cursor-default">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="tracking-widest text-emerald-100/90 uppercase font-oswald text-xs font-semibold">
            Watchdog Online • 385ms Edge Latency
          </span>
        </div>

        {/* Hero Headline in Oswald Font with Deep Glowing Text */}
        <h1 className="font-oswald text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.05] uppercase drop-shadow-2xl">
          The Sovereign Voice AI Engine for{" "}
          <span className="inline-block bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
            Local Commerce
          </span>
        </h1>

        {/* Core Vision: Listen, Understand, Respond Naturally, Perform Actions */}
        <p className="mt-6 text-base sm:text-xl lg:text-2xl text-slate-200 max-w-3xl mx-auto font-medium leading-relaxed font-sans">
          AI systems that <span className="text-emerald-400 font-bold">listen</span>,{" "}
          <span className="text-teal-300 font-bold">understand</span>,{" "}
          <span className="text-cyan-400 font-bold">respond naturally</span>, and{" "}
          <span className="text-white font-bold underline decoration-emerald-500/70 decoration-2">perform real-world actions</span> through spoken conversations.
        </p>

        {/* Vedic Etymology & Philosophy Badge */}
        <div className="mt-8 inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400 font-mono shadow-sm backdrop-blur-md">
          <span className="text-emerald-400 font-bold font-oswald text-sm tracking-wide">वाणी (Vāṇī)</span>
          <span className="opacity-50">|</span>
          <span>Sacred Speech &amp; Human Voice</span>
          <span className="opacity-50">•</span>
          <span className="text-cyan-400 font-bold font-oswald text-sm tracking-wide">Edge</span>
          <span className="opacity-50">|</span>
          <span>Sub-Second Telephony</span>
        </div>

        {/* Developer Instant Access & Email Auth Badge */}
        <div className="mt-8 flex items-center justify-center">
          <button 
            type="button"
            onClick={() => onOpenAuth("signup")}
            className="group relative inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_0_25px_rgba(52,211,153,0.15)] hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(52,211,153,0.3)] transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 group-hover:bg-emerald-400 transition-colors"></span>
            </span>
            <span className="relative z-10 text-gray-300 font-medium text-sm">Get Started Free:</span>
            <span className="relative z-10 text-white font-bold font-oswald text-sm uppercase tracking-wider underline decoration-emerald-500/50 decoration-2 group-hover:decoration-emerald-400 transition-all">
              Create Free Account
            </span>
            <span className="relative z-10 text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase font-oswald border border-emerald-500/30">
              500 Free Minutes
            </span>
          </button>
        </div>

        {/* Subtitle in Crisp Gray Text */}
        <p className="mt-10 text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
          Never lose a customer to missed calls, busy tones, or language barriers. VaniEdge fuses{" "}
          <strong className="text-white font-medium">Cloudflare edge streaming</strong>, an atomic{" "}
          <strong className="text-white font-medium">&lt;1,200ms failover watchdog</strong>, and embedded{" "}
          <strong className="text-white font-medium">SutraDB vector memory</strong> into a 24/7 autonomous receptionist.
        </p>

        {/* Primary Call to Action Buttons */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={onScrollToStudio}
            className="px-8 py-4 rounded-xl bg-white text-black font-bold font-oswald text-lg uppercase tracking-wider shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Bot className="w-5 h-5" />
            <span>Launch Interactive Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onOpenCustomizer && (
            <button
              type="button"
              onClick={onOpenCustomizer}
              className="px-8 py-4 rounded-xl bg-[#111] border border-white/20 text-white font-bold font-oswald text-lg uppercase tracking-wider hover:bg-[#1a1a1a] hover:border-white/40 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Customize Engine</span>
            </button>
          )}
        </div>

        {/* Live Performance Metric Badges */}
        <div className="mt-20 pt-10 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <Server className="w-6 h-6 text-emerald-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">11.8<span className="text-xl text-gray-500">ms</span></div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">SutraDB Edge RAG</div>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <Zap className="w-6 h-6 text-amber-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">&lt; 1.2<span className="text-xl text-gray-500">s</span></div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">Turn-Taking TTFT</div>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <ShieldCheck className="w-6 h-6 text-cyan-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">100<span className="text-xl text-gray-500">%</span></div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">Zero Dropped Calls</div>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <Activity className="w-6 h-6 text-purple-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">8+</div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">Vertical Modules</div>
          </div>
        </div>
      </div>
    </section>
  );
}
