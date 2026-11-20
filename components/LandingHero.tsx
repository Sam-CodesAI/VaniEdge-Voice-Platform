import React from "react";
import Link from "next/link";
import {
  Bot,
  ArrowRight,
  Sliders,
  Zap,
  Server,
  ShieldCheck,
  Activity,
  PhoneCall,
  Layers,
  Sparkles,
  Smartphone,
  Code2,
} from "lucide-react";

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
          <span className="text-white font-bold underline decoration-emerald-500/70 decoration-2">
            perform real-world actions
          </span>{" "}
          through spoken conversations.
        </p>

        {/* Vedic Etymology & Philosophy Badge */}
        <div className="mt-8 inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400 font-mono shadow-sm backdrop-blur-md">
          <span className="text-emerald-400 font-bold font-oswald text-sm tracking-wide">
            वाणी (Vāṇī)
          </span>
          <span className="opacity-50">|</span>
          <span>Sacred Speech &amp; Human Voice</span>
          <span className="opacity-50">•</span>
          <span className="text-cyan-400 font-bold font-oswald text-sm tracking-wide">Edge</span>
          <span className="opacity-50">|</span>
          <span>Sub-Second Telephony</span>
        </div>

        {/* Dual Product Ecosystem: Receptionist vs Platform */}
        <div className="mt-12 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* PRODUCT 1: VaniEdge Receptionist */}
          <div className="relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#0a0f0d] to-black border border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.12)] flex flex-col justify-between group hover:border-emerald-500/70 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  Flagship Business Application
                </span>
                <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  Zero Porting
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white flex items-center gap-2">
                  <PhoneCall className="w-6 h-6 text-emerald-400" />
                  VaniEdge Receptionist
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 mt-2 leading-relaxed">
                  The plug-and-play AI voice receptionist for clinics, salons, towing services, and local businesses. Answers calls 24/7, books appointments into your calendar, and warm-transfers emergencies to duty staff.
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-gray-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Keeps your existing number via carrier conditional forwarding (*409* / *71*)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Automated SMS appointment confirmations dispatched to callers</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
              <Link
                href="/receptionist/onboarding"
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>60s Setup Wizard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/receptionist"
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-oswald uppercase text-xs font-bold transition-colors"
              >
                Open Dashboard
              </Link>
            </div>
          </div>

          {/* PRODUCT 2: VaniEdge Platform */}
          <div className="relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#090b12] to-black border border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.12)] flex flex-col justify-between group hover:border-blue-500/70 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold">
                  Enterprise Infrastructure
                </span>
                <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  &lt;5ms SutraDB
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white flex items-center gap-2">
                  <Layers className="w-6 h-6 text-blue-400" />
                  VaniEdge Platform
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 mt-2 leading-relaxed">
                  The underlying voice telephony infrastructure for agencies and developers to create, provision, and deploy custom voice AI agents for their own clients.
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-gray-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Multi-tenant PBX isolation with carrier DID trunking (Twilio, Exotel, SIP)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Sub-second failover watchdog (&lt;1,200ms SLA) + OpenAPI 3.1 REST layer</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
              <Link
                href="/platform"
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-oswald uppercase text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Explore Platform Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/platform"
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-oswald uppercase text-xs font-bold transition-colors"
              >
                OpenAPI 3.1 &amp; Trunks
              </Link>
            </div>
          </div>
        </div>

        {/* Interactive Studio & Customizer Action Buttons */}
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
        <div className="mt-16 pt-10 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center max-w-5xl mx-auto w-full">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <Server className="w-6 h-6 text-emerald-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">
              3.8<span className="text-xl text-gray-500">ms</span>
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">
              SutraDB Edge RAG
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <Zap className="w-6 h-6 text-amber-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">
              &lt; 1.2<span className="text-xl text-gray-500">s</span>
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">
              Watchdog TTFT SLA
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <ShieldCheck className="w-6 h-6 text-cyan-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">
              100<span className="text-xl text-gray-500">%</span>
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">
              Zero Dropped Calls
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group">
            <Activity className="w-6 h-6 text-purple-500 mx-auto mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl sm:text-4xl font-black text-white font-oswald tracking-tight">
              8+
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 uppercase tracking-widest font-oswald">
              Vertical Modules
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
