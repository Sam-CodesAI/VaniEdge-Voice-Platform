"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Phone,
  Code2,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Heart,
  Globe2,
  PhoneCall,
  Layers,
} from "lucide-react";

interface LandingFooterProps {
  onOpenAuth?: (mode?: "signin" | "signup") => void;
}

export default function LandingFooter({ onOpenAuth }: LandingFooterProps) {
  return (
    <footer className="bg-[#050508] border-t border-white/10 pt-16 pb-12 text-white text-xs font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Call to Action Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0b0f14] to-black border border-emerald-500/40 p-8 sm:p-12 mb-16 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-emerald-400 text-xs font-oswald uppercase tracking-wider font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>COMMERCIAL ONBOARDING OPEN</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white font-oswald uppercase tracking-tight">
              Ready to automate your business calls with sub-second AI?
            </h2>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed font-normal">
              Eliminate missed calls and scale customer intake with zero phone number porting. Deploy your AI voice receptionist in 60 seconds or integrate via developer APIs.
            </p>
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/receptionist/onboarding"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-bold font-oswald uppercase tracking-wider text-sm shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>Launch 60s Setup Wizard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/platform"
                className="px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold font-oswald uppercase tracking-wider text-sm hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Open Platform Console</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4-Column Footer Navigation Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-black font-bold font-oswald text-xs">
                V
              </div>
              <span className="font-bold text-base tracking-wider text-white font-oswald uppercase">
                VANIEDGE
              </span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed font-normal">
              The sovereign voice AI engine for local commerce. Sub-second edge telephony, embedded SutraDB vector memory, and zero dropped calls.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>&lt;1,200ms Watchdog SLA</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white font-oswald block mb-3">
              Products &amp; Apps
            </span>
            <ul className="space-y-2 text-xs font-medium text-gray-400">
              <li>
                <Link href="/receptionist" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                  <span>VaniEdge Receptionist</span>
                </Link>
              </li>
              <li>
                <Link href="/receptionist/onboarding" className="hover:text-emerald-400 transition-colors">
                  60s Setup Wizard
                </Link>
              </li>
              <li>
                <Link href="/platform" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>VaniEdge Platform</span>
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Inbound Call Logs &amp; Transcripts
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white font-oswald block mb-3">
              Navigation
            </span>
            <ul className="space-y-2 text-xs font-medium text-gray-400">
              <li>
                <a href="#studio" className="hover:text-white transition-colors">
                  Live Interactive Studio
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  Industry Solutions
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Commercial Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white font-oswald block mb-3">
              Developer Endpoints
            </span>
            <ul className="space-y-2 text-xs font-mono text-gray-400">
              <li>
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                >
                  <span>/api/health</span>
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              </li>
              <li>
                <a
                  href="/api/metrics"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                >
                  <span>/api/metrics</span>
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              </li>
              <li>
                <a
                  href="/api/receptionist/appointments"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                >
                  <span>/api/receptionist/appointments</span>
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Sam-CodesAI/VaniEdge-Voice-Platform"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500">
          <div className="flex items-center gap-1">
            <span>Built with precision for 2026 voice commerce. Zero dropped calls guaranteed.</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <a href="https://t.me/Samarth1306" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white">
              Telegram: @Samarth1306
            </a>
            <span>•</span>
            <a href="https://vaniedge.vercel.app" className="text-emerald-400 hover:underline">
              vaniedge.vercel.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
