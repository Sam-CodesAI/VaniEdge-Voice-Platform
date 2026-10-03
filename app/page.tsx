"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone,
  Globe2,
  ExternalLink,
  Code2,
  Sparkles,
  Menu,
  X,
  Bot,
  Activity,
  ArrowRight,
  LogOut,
  User as UserIcon,
  Key,
} from "lucide-react";
import VaniStudioView, { BusinessCategory, AVAILABLE_CATEGORIES } from "@/components/VaniStudioView";
import { TelephonyMissionControl } from "@/components/TelephonyMissionControl";
import LandingHero from "@/components/LandingHero";
import CinematicVoiceScrollytelling from "@/components/CinematicVoiceScrollytelling";
import BentoArchitecture from "@/components/BentoArchitecture";
import IndustrySolutionsSection from "@/components/IndustrySolutionsSection";
import PricingSection from "@/components/PricingSection";
import FaqSection from "@/components/FaqSection";
import LandingFooter from "@/components/LandingFooter";
import AuthModal from "@/components/AuthModal";
import CredentialsModal from "@/components/CredentialsModal";
import VerticalCustomizerModal from "@/components/VerticalCustomizerModal";
import { UserRecord, UserCredentials } from "@/lib/auth-store";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  latencyMs?: number;
  matchedDoc?: string;
  audioUrl?: string;
}

interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  speechLocale: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English (India)", nativeLabel: "English", speechLocale: "en-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिंदी", speechLocale: "hi-IN" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", speechLocale: "kn-IN" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", speechLocale: "mr-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", speechLocale: "ta-IN" },
  { code: "es", label: "Spanish", nativeLabel: "Español", speechLocale: "es-ES" },
];

export default function VaniEdgePage() {
  // Telephony & Call State
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);

  // Business Persona State
  const [selectedPersona, setSelectedPersona] = useState<BusinessCategory>("clinic");
  const [businessName, setBusinessName] = useState<string>("CarePlus Healthcare & Clinics");
  const [selectedVoice, setSelectedVoice] = useState<string>("sarah");
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechPitch, setSpeechPitch] = useState<number>(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  // Live Transcript State
  const [transcript, setTranscript] = useState<Message[]>([
    {
      id: "initial-msg",
      sender: "agent",
      text: "Namaste! Welcome to CarePlus Healthcare & Clinics. How may I assist with your doctor appointment or consultation today?",
      timestamp: "Just now",
      latencyMs: 14.2,
    },
  ]);
  const [customQuery, setCustomQuery] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Authentication State (ElevenLabs & IBM Platform Standard)
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signup");
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState<boolean>(false);

  const handleOpenAuth = (mode: "signin" | "signup" = "signup") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleCredentialsUpdated = (newCredentials: UserCredentials) => {
    if (currentUser) {
      const updated: UserRecord = {
        ...currentUser,
        credentials: newCredentials,
      };
      setCurrentUser(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("vaniedge_auth_user", JSON.stringify(updated));
      }
    }
  };

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("vaniedge_auth_user");
      localStorage.removeItem("vaniedge_session_token");
      document.cookie = "vaniedge_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    }
    setCurrentUser(null);
    setUserDropdownOpen(false);
  };

  // Vertical Customizer Modal State (60s Onboarding Wizard)
  const [customizerOpen, setCustomizerOpen] = useState<boolean>(false);

  const handleDeployCustomizer = (config: {
    category: BusinessCategory;
    businessName: string;
    language: string;
    operatingHours: string;
    servicesText: string;
  }) => {
    setSelectedPersona(config.category);
    setBusinessName(config.businessName);
    setSelectedLanguage(config.language);

    const customGreeting = `Namaste! Welcome to ${config.businessName}. Operating hours: ${config.operatingHours}. How may I assist your call today?`;
    setTranscript([
      {
        id: `custom-init-${Date.now()}`,
        sender: "agent",
        text: customGreeting,
        timestamp: "Just now",
        latencyMs: 10.4,
        matchedDoc: "Custom Vertical Knowledge & Services",
      },
    ]);

    scrollToSection("studio");
    speakVoiceResponse(customGreeting);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Audio & Mic Refs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Load browser voices, restore auth session & setup Web Speech Recognition on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedUser = localStorage.getItem("vaniedge_auth_user");
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch {
        // Ignore JSON parse errors
      }

      const updateVoices = () => {
        const available = window.speechSynthesis?.getVoices() || [];
        setBrowserVoices(available);
      };
      updateVoices();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;

        recog.onresult = (event: any) => {
          const text = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join("");
          setCustomQuery(text);
        };

        recog.onend = () => setIsListening(false);
        recog.onerror = () => setIsListening(false);
        recognitionRef.current = recog;
      }
    }
  }, []);

  // Call duration counter
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCalling) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isCalling]);

  // Voice synthesis via ElevenLabs streaming with Browser SpeechSynthesis fallback
  const speakVoiceResponse = useCallback(
    async (text: string) => {
      if (typeof window === "undefined") return;

      // 1. ElevenLabs Edge Streaming
      try {
        setIsSpeaking(true);
        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voiceId: selectedVoice,
            languageCode: selectedLanguage,
          }),
        });

        if (ttsRes.ok) {
          const blob = await ttsRes.blob();
          const audioUrl = URL.createObjectURL(blob);
          if (audioPlayerRef.current) {
            audioPlayerRef.current.src = audioUrl;
            audioPlayerRef.current.playbackRate = speechRate;
            audioPlayerRef.current.onended = () => {
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl);
            };
            audioPlayerRef.current.onerror = () => {
              setIsSpeaking(false);
            };
            try {
              await audioPlayerRef.current.play();
              return;
            } catch {
              // Fallback to speech synthesis if audio play is blocked
            }
          }
        }
      } catch {
        // Fallback to speech synthesis
      }

      // 2. Local Browser SpeechSynthesis Fallback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speechRate;
        utterance.pitch = speechPitch;

        const langMeta = LANGUAGES.find((l) => l.code === selectedLanguage);
        if (langMeta) utterance.lang = langMeta.speechLocale;

        if (browserVoices.length > 0) {
          const matched =
            browserVoices.find((v) => v.lang.toLowerCase().startsWith(selectedLanguage.toLowerCase())) ||
            browserVoices.find((v) => v.name.toLowerCase().includes(selectedVoice.toLowerCase()));
          if (matched) utterance.voice = matched;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    },
    [selectedVoice, selectedLanguage, speechRate, speechPitch, browserVoices]
  );

  // Send message
  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || customQuery;
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setTranscript((prev) => [...prev, userMsg]);
    setCustomQuery("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          persona: selectedPersona,
          language: selectedLanguage,
          businessName,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        voiceResponse?: string;
        retrieval?: {
          latencyMs?: number;
          matchedDocument?: { title?: string };
        };
      };

      if (data.success && data.voiceResponse) {
        const agentMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          sender: "agent",
          text: data.voiceResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs: data.retrieval?.latencyMs || 8.4,
          matchedDoc: data.retrieval?.matchedDocument?.title,
        };
        setTranscript((prev) => [...prev, agentMsg]);
        speakVoiceResponse(data.voiceResponse);
      }
    } catch {
      const fallbackMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "agent",
        text: "I have recorded your request. Our desk will confirm with you shortly.",
        timestamp: "Just now",
      };
      setTranscript((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Call & Mic Controls
  const handleToggleCall = () => {
    if (isCalling || isConnecting) {
      setIsCalling(false);
      setIsConnecting(false);
      setIsSpeaking(false);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    } else {
      setIsConnecting(true);
      setTimeout(() => {
        setIsConnecting(false);
        setIsCalling(true);
        speakVoiceResponse(
          `Connected to ${businessName}. Namaste! How may I assist your call today?`
        );
      }, 700);
    }
  };

  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      alert("Microphone recognition is supported in Chrome, Edge, and Android mobile browsers.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        const langMeta = LANGUAGES.find((l) => l.code === selectedLanguage);
        if (langMeta) recognitionRef.current.lang = langMeta.speechLocale;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Mic start error:", err);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Switch Business Persona
  const handleSelectPersona = (p: BusinessCategory) => {
    setSelectedPersona(p);
    const cat = AVAILABLE_CATEGORIES.find((c) => c.id === p);
    const defaultName = cat?.defaultBusinessName || "VaniEdge AI Assistant";
    setBusinessName(defaultName);

    const personaGreetings: Record<
      BusinessCategory,
      { voice: string; rate: number; pitch: number; greeting: string; latency: number }
    > = {
      clinic: {
        voice: "sarah",
        rate: 1.0,
        pitch: 1.0,
        greeting:
          "Namaste! Welcome to CarePlus Healthcare & Clinics. How may I assist with your doctor appointment, consultation, or triage today?",
        latency: 12.4,
      },
      restaurant: {
        voice: "bella",
        rate: 1.05,
        pitch: 1.05,
        greeting:
          "Namaste! Welcome to Royal Feast Kitchen & Dining. Would you like to place a food delivery order, reserve a dining table, or check our daily menu?",
        latency: 11.8,
      },
      auto: {
        voice: "adam",
        rate: 1.1,
        pitch: 0.95,
        greeting:
          "Apex 24/7 Roadside Rescue dispatch center. Do you require immediate vehicle towing, battery jumpstart, tyre repair, or fuel delivery?",
        latency: 10.5,
      },
      retail: {
        voice: "sarah",
        rate: 1.0,
        pitch: 1.0,
        greeting:
          "Hello! Welcome to PrimeGoods Retail. How can I help you with your order status, return request, or product stock inquiry today?",
        latency: 13.1,
      },
      realestate: {
        voice: "adam",
        rate: 1.0,
        pitch: 1.0,
        greeting:
          "Welcome to Skyline Realty & Properties. Are you looking to schedule an apartment viewing, inquire about lease terms, or check property pricing?",
        latency: 12.9,
      },
      finance: {
        voice: "sarah",
        rate: 1.0,
        pitch: 1.0,
        greeting:
          "Welcome to Apex Financial & Banking. How can I assist with your account balance, loan inquiry, or card services today?",
        latency: 14.0,
      },
      hospitality: {
        voice: "bella",
        rate: 1.0,
        pitch: 1.05,
        greeting:
          "Welcome to Grand Horizon Suites & Hotel. How may I assist you with room reservations, check-in amenities, or airport shuttle transfers?",
        latency: 12.2,
      },
      general: {
        voice: "sarah",
        rate: 1.0,
        pitch: 1.0,
        greeting:
          "Hello! Welcome to Enterprise Concierge Support. How may I direct your call, assist your inquiry, or schedule a callback for you?",
        latency: 11.2,
      },
    };

    const cfg = personaGreetings[p] || personaGreetings.general;
    setSelectedVoice(cfg.voice);
    setSpeechRate(cfg.rate);
    setSpeechPitch(cfg.pitch);
    setTranscript([
      {
        id: `init-${Date.now()}`,
        sender: "agent",
        text: cfg.greeting,
        timestamp: "Just now",
        latencyMs: cfg.latency,
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-emerald-400 selection:text-black scroll-smooth">
      {/* Hidden Audio Player for ElevenLabs Streaming */}
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Main Content Area */}
      <div className="flex flex-col min-h-screen w-full">
        {/* Top Sticky Navigation Bar */}
        <header className="border-b border-slate-200 bg-white/95 sticky top-0 z-50 shadow-sm backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Left Brand */}
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("overview");
              }}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className="relative h-10 w-10 rounded-xl overflow-hidden shadow-md border-2 border-emerald-500 group-hover:scale-105 transition-all shrink-0">
                <img
                  src="/vaniedge-logo.png"
                  alt="VaniEdge Voice Platform Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight text-black font-oswald uppercase">
                    VaniEdge
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 text-black border border-slate-300 font-bold tracking-wider font-oswald">
                    VOICE PLATFORM
                  </span>
                </div>
                <span className="text-[11px] text-black font-mono font-semibold -mt-0.5 hidden sm:block">
                  Sub-Second Telephony &amp; SutraDB RAG
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6 text-xs font-bold font-oswald uppercase text-black">
              <a
                href="/demos/voice-agent"
                className="text-cyan-700 hover:text-cyan-900 transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
              >
                <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                Telephony v2.0
              </a>
              <a
                href="/agency"
                className="hover:text-emerald-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                Agency Portal
              </a>
              <button
                type="button"
                onClick={() => scrollToSection("overview")}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("studio")}
                className="hover:text-emerald-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Studio
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("cinematic-scrollytelling")}
                className="hover:text-emerald-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
                180ms Flight
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("industries")}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                8 Industries
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("architecture")}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Architecture
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("mission-control")}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Audited Call &amp; Watchdog
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("pricing")}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("faq")}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                FAQ
              </button>
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-black hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1 font-bold font-oswald"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Customize in 60s</span>
              </button>
            </nav>

            {/* Right Quick Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Spoken Language Selector */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs shadow-sm">
                <Globe2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setSelectedLanguage(newLang);
                    const langMeta = LANGUAGES.find((l) => l.code === newLang);
                    if (recognitionRef.current && langMeta) {
                      recognitionRef.current.lang = langMeta.speechLocale;
                    }
                    if (isCalling) {
                      const switchAudio: Record<string, string> = {
                        hi: "नमस्ते, भाषा बदलकर हिंदी कर दी गई है।",
                        kn: "ನಮಸ್ಕಾರ, ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.",
                        mr: "नमस्कार, भाषा मराठीत बदलली आहे.",
                        ta: "வணக்கம், மொழி தமிழுக்கு மாற்றப்பட்டுள்ளது.",
                        es: "Hola, idioma cambiado a español.",
                        en: "Switched to English.",
                      };
                      speakVoiceResponse(switchAudio[newLang] || `Language set to ${langMeta?.label || newLang}.`);
                    }
                  }}
                  className="bg-transparent text-black text-xs font-bold focus:outline-none cursor-pointer pr-1"
                  aria-label="Select Spoken Language"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-white text-black font-semibold">
                      {l.label} ({l.nativeLabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Authentication Actions */}
              {currentUser ? (
                <div className="flex items-center gap-2">
                  {/* Quick Credentials Modal Opener */}
                  <button
                    type="button"
                    onClick={() => setCredentialsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-oswald uppercase text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                    title="View API Keys & SIP Credentials"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Credentials</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-black text-xs text-black font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <div className="h-6 w-6 rounded-full bg-black text-white font-bold flex items-center justify-center text-[11px] font-oswald">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <span className="hidden sm:inline font-bold">{currentUser.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-black font-mono font-bold hidden md:inline border border-slate-200">
                        {currentUser.tier}
                      </span>
                    </button>

                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border-2 border-slate-200 p-2 shadow-2xl z-50 animate-in fade-in text-black">
                        <div className="px-3 py-2 border-b border-slate-200">
                          <div className="text-xs font-bold text-black font-oswald uppercase truncate">{currentUser.name}</div>
                          <div className="text-[11px] text-slate-600 font-mono truncate">{currentUser.email}</div>
                          <div className="text-[10px] text-emerald-700 font-mono font-bold mt-0.5 truncate">
                            DID: {currentUser.credentials.assignedPhoneNumber}
                          </div>
                        </div>
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setUserDropdownOpen(false);
                              setCredentialsModalOpen(true);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-black font-oswald uppercase font-bold hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5 text-emerald-600" />
                            <span>API Keys &amp; SIP Trunks</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUserDropdownOpen(false);
                              scrollToSection("studio");
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-black font-oswald uppercase font-bold hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Interactive Studio</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUserDropdownOpen(false);
                              scrollToSection("mission-control");
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-black font-oswald uppercase font-bold hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Activity className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Carrier Health &amp; Watchdog</span>
                          </button>
                        </div>
                        <div className="pt-1 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="w-full text-left px-3 py-1.5 text-xs text-rose-600 font-oswald uppercase font-bold hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAuth("signin")}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold font-oswald uppercase text-black hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAuth("signup")}
                    className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold font-oswald uppercase text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Get Started Free</span>
                  </button>
                </div>
              )}

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg bg-white border border-slate-300 text-black lg:hidden cursor-pointer"
                aria-label="Toggle Mobile Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 font-bold font-oswald uppercase text-sm text-black">
              <button
                type="button"
                onClick={() => scrollToSection("overview")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("studio")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                Live Interactive Studio
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("cinematic-scrollytelling")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700 flex items-center gap-1.5"
              >
                <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
                180ms Telephony Flight
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("industries")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                8 Industry Personas
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("architecture")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                Vani + Edge Architecture
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("mission-control")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                Audited Call &amp; BridgeView Watchdog
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("pricing")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                Commercial Pricing
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("faq")}
                className="block w-full text-left py-1 text-black hover:text-emerald-700"
              >
                Frequently Asked Questions
              </button>
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 rounded-lg bg-slate-800 text-rose-400 font-bold text-center text-xs flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out ({currentUser.name})</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleOpenAuth("signin");
                      }}
                      className="w-full py-2 rounded-lg bg-slate-800 text-white font-semibold text-center text-xs"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleOpenAuth("signup");
                      }}
                      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-center text-xs"
                    >
                      Get Started Free
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Landing Page Content Sections */}
        <main className="w-full flex-1 flex flex-col">
          {/* 1. Hero Section */}
          <div id="overview">
            <LandingHero
              onScrollToStudio={() => scrollToSection("studio")}
              onOpenAuth={handleOpenAuth}
              onOpenCustomizer={() => setCustomizerOpen(true)}
            />
          </div>

          {/* 2. Interactive Live Studio Section */}
          <section id="studio" className="py-16 sm:py-20 border-b border-slate-200 bg-slate-50/70 relative scroll-mt-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-3xl mx-auto mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-100 border border-slate-300 text-black text-xs font-oswald uppercase tracking-wider font-bold mb-3">
                  <Bot className="w-3.5 h-3.5 text-emerald-600" />
                  <span>INTERACTIVE LIVE TELEPHONY STUDIO</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-bold text-black font-oswald uppercase tracking-tight">
                  Experience VaniEdge in Real Time
                </h2>
                <p className="mt-3 text-sm sm:text-base text-black font-medium">
                  Select any of the 8 business categories below, start a browser call or click sample test prompts to observe sub-15ms SutraDB vector retrieval and multi-lingual voice speech generation.
                </p>
              </div>

              <VaniStudioView
                isCalling={isCalling}
                isConnecting={isConnecting}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isThinking={isProcessing}
                callDuration={callDuration}
                formatDuration={formatDuration}
                transcript={transcript}
                customQuery={customQuery}
                setCustomQuery={setCustomQuery}
                isProcessing={isProcessing}
                onSend={handleSend}
                onToggleCall={handleToggleCall}
                onToggleMic={handleToggleMic}
                onReplayAudio={speakVoiceResponse}
                selectedPersona={selectedPersona}
                onSelectPersona={handleSelectPersona}
                selectedLanguage={selectedLanguage}
                onSelectLanguage={setSelectedLanguage}
                languages={LANGUAGES}
              />
            </div>
          </section>

          {/* Cinematic Scrollytelling Telephony Flight (Zero AI-Slop / Continuous Scrollytelling Engine) */}
          <CinematicVoiceScrollytelling />

          {/* 3. Bento Architecture Grid */}
          <BentoArchitecture />

          {/* 4. 8 Turnkey Industry Solutions */}
          <IndustrySolutionsSection onSelectCategory={(id) => handleSelectPersona(id)} />

          {/* 5. Telephony Failover Mission Control */}
          <section id="mission-control" className="py-16 sm:py-20 border-b border-slate-200 bg-slate-50/70 scroll-mt-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-3xl mx-auto mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-100 border border-slate-300 text-black text-xs font-oswald uppercase tracking-wider font-bold mb-3">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>TELEPHONY AUDIT, FAILOVER WATCHDOG &amp; BRIDGEVIEW</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-bold text-black font-oswald uppercase tracking-tight">
                  Live Mission Control, Audited Call &amp; BridgeView Suite
                </h2>
                <p className="mt-3 text-sm sm:text-base text-black font-medium">
                  Inspect live PSTN carrier health, play the audited inbound call recording with stage-by-stage latency telemetry (385ms TTFT), and manage BridgeView dispatch tickets with verified SHA-checksums.
                </p>
              </div>

              <div className="max-w-5xl mx-auto">
                <TelephonyMissionControl />
              </div>
            </div>
          </section>

          {/* 6. Commercial Pricing Matrix */}
          <PricingSection />

          {/* 7. Frequently Asked Questions */}
          <FaqSection />
        </main>

        {/* 8. Modern Conversion Footer */}
        <LandingFooter onOpenAuth={handleOpenAuth} />
      </div>

      {/* Modern Authentication Modal (Email/Password) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          if (token && typeof window !== "undefined") {
            localStorage.setItem("vaniedge_session_token", token);
          }
        }}
      />

      {/* Developer Credentials & SIP Trunk Inspector Modal */}
      <CredentialsModal
        isOpen={credentialsModalOpen}
        onClose={() => setCredentialsModalOpen(false)}
        user={currentUser}
        onCredentialsUpdated={handleCredentialsUpdated}
      />

      {/* 60-Second Vertical Customizer Wizard Modal */}
      <VerticalCustomizerModal
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        onDeployToStudio={handleDeployCustomizer}
      />
    </div>
  );
}
