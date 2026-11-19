"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PhoneCall, Building, User, LogOut, ArrowLeft } from "lucide-react";
import { AgencyMasterConsole } from "@/components/AgencyMasterConsole";
import LandingFooter from "@/components/LandingFooter";
import AuthModal from "@/components/AuthModal";
import { UserRecord } from "@/lib/auth-store";

export default function AgencyPage() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { user?: UserRecord };
          if (data.user) setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenAuth = (mode: "signin" | "signup" = "signin") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Ignore
    }
    setCurrentUser(null);
    setUserDropdownOpen(false);
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-[#070709] text-gray-100 selection:bg-blue-600/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0d0d12]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Building className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="font-bold font-oswald text-lg tracking-wider text-white">
                  VANIEDGE
                </span>
                <span className="text-[10px] block font-mono text-blue-400">
                  AGENCY MASTER CONSOLE
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
              >
                Inbound Call Logs
              </Link>
              <Link
                href="/demos/voice-agent"
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
              >
                Mission Control
              </Link>
              <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white font-medium">
                Agency Tenants
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Line Badge */}
            <a
              href="tel:+918047259000"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
              <span>+91 80 4725 9000</span>
            </a>

            {/* Auth Button / User Dropdown */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="max-w-[120px] truncate">{currentUser.name}</span>
                </button>
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#13131a] border border-white/10 shadow-2xl py-1 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-white/10 text-gray-400 truncate">
                      {currentUser.email}
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenAuth("signin")}
                className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer font-oswald uppercase tracking-wider"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Agency Content */}
      <div className="pt-8 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-white transition-colors group mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to VaniEdge Home</span>
          </Link>
          <h1 className="text-3xl font-extrabold font-oswald uppercase tracking-tight text-white">
            Agency Master Console
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Provision, brand, and monitor isolated multi-tenant voice receptionists for clients.
          </p>
        </div>

        <AgencyMasterConsole
          currentUser={currentUser}
          onOpenAuth={handleOpenAuth}
        />
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
          window.location.reload();
        }}
      />

      <LandingFooter />
    </main>
  );
}
