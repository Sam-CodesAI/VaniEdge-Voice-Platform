"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PhoneCall,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building,
  Volume2,
  Sliders,
  ShieldCheck,
  Check,
  Copy,
  Smartphone,
  Phone,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight,
  Radio,
  Play,
  RotateCcw,
} from "lucide-react";

interface ServiceItem {
  id: string;
  name: string;
  price: string;
  duration: string;
}

const INDUSTRY_PRESETS = [
  {
    id: "clinic",
    name: "Clinic & Healthcare",
    icon: "🏥",
    defaultName: "CarePlus Healthcare & Clinics",
    defaultServices: [
      { id: "1", name: "General Physician Consultation", price: "₹500", duration: "20 mins" },
      { id: "2", name: "Pediatric Wellness Checkup", price: "₹600", duration: "30 mins" },
      { id: "3", name: "Vaccination Administration", price: "₹400", duration: "15 mins" },
    ],
    defaultGreeting:
      "Namaste! Welcome to CarePlus Healthcare & Clinics. I am Sarah, your AI receptionist. How may I assist with your doctor appointment or medical inquiry today?",
    recommendedVoice: "sarah",
  },
  {
    id: "salon",
    name: "Salon & Wellness Spa",
    icon: "💇",
    defaultName: "Luxe Glow Salon & Spa",
    defaultServices: [
      { id: "1", name: "Executive Haircut & Styling", price: "₹800", duration: "45 mins" },
      { id: "2", name: "Hydrating Facial Treatment", price: "₹1,500", duration: "60 mins" },
      { id: "3", name: "Aromatherapy Full Body Massage", price: "₹2,200", duration: "60 mins" },
    ],
    defaultGreeting:
      "Hello and welcome to Luxe Glow Salon and Spa! I am Bella, your virtual receptionist. Would you like to reserve a time for hair styling, facial therapy, or a relaxing spa session?",
    recommendedVoice: "bella",
  },
  {
    id: "auto",
    name: "Auto Repair & 24/7 Towing",
    icon: "🚗",
    defaultName: "Apex Emergency Auto & Towing",
    defaultServices: [
      { id: "1", name: "24/7 Roadside Flatbed Towing", price: "₹1,800 + km", duration: "Immediate" },
      { id: "2", name: "Battery Jumpstart & Diagnostics", price: "₹750", duration: "30 mins" },
      { id: "3", name: "Comprehensive Brake Inspection", price: "₹1,200", duration: "45 mins" },
    ],
    defaultGreeting:
      "Apex Emergency Auto and Towing! I am Joanna, your dispatch assistant. Are you stranded on the road needing immediate towing, or scheduling a vehicle inspection?",
    recommendedVoice: "joanna",
  },
  {
    id: "restaurant",
    name: "Restaurant & Bistro",
    icon: "🍽️",
    defaultName: "Royal Feast Kitchen & Bistro",
    defaultServices: [
      { id: "1", name: "Table Reservation (2-4 Guests)", price: "Free", duration: "90 mins" },
      { id: "2", name: "Private Dining Hall Reservation", price: "₹5,000 min", duration: "180 mins" },
      { id: "3", name: "Catering & Banquet Consultation", price: "Custom Quote", duration: "30 mins" },
    ],
    defaultGreeting:
      "Namaste and welcome to Royal Feast Kitchen & Bistro! I am Bella. May I help you reserve a table for lunch or dinner, or arrange an event catering order?",
    recommendedVoice: "bella",
  },
  {
    id: "realestate",
    name: "Real Estate & Property",
    icon: "🏢",
    defaultName: "Prestige Prime Realty Advisory",
    defaultServices: [
      { id: "1", name: "2BHK / 3BHK Site Walkthrough Tour", price: "Free", duration: "45 mins" },
      { id: "2", name: "Commercial Office Leasing Consultation", price: "Free", duration: "30 mins" },
      { id: "3", name: "Property Valuation & Listing Review", price: "₹1,000", duration: "45 mins" },
    ],
    defaultGreeting:
      "Good day! Welcome to Prestige Prime Realty Advisory. I am Matthew, your property concierge. Are you inquiring about touring a luxury residential apartment or scheduling a commercial lease consultation?",
    recommendedVoice: "matthew",
  },
  {
    id: "services",
    name: "Professional & Legal Services",
    icon: "⚖️",
    defaultName: "Horizon Advisory Partners",
    defaultServices: [
      { id: "1", name: "30-Minute Legal Strategy Consultation", price: "₹2,500", duration: "30 mins" },
      { id: "2", name: "Tax Audit & Corporate Filings Review", price: "₹3,500", duration: "45 mins" },
      { id: "3", name: "Trademark & IP Registration Intro", price: "₹1,500", duration: "30 mins" },
    ],
    defaultGreeting:
      "Hello, welcome to Horizon Advisory Partners. I am Matthew, your client intake assistant. How can we direct your legal or financial advisory consultation today?",
    recommendedVoice: "matthew",
  },
];

const CARRIER_FORWARDING_CODES: Record<string, { name: string; prefix: string; suffix: string; label: string; desc: string }> = {
  jio: {
    name: "Reliance Jio (India)",
    prefix: "*409*",
    suffix: "#",
    label: "Call Forwarding When Busy / Unanswered",
    desc: "Recommended for Jio users. Forwards callers only when you cannot answer.",
  },
  airtel: {
    name: "Bharti Airtel (India)",
    prefix: "*71*",
    suffix: "#",
    label: "Call Forwarding When Unanswered",
    desc: "Forwards to your AI receptionist after 3 rings if you are unavailable.",
  },
  vi: {
    name: "Vodafone Idea (Vi)",
    prefix: "*67*",
    suffix: "#",
    label: "Call Forwarding When Busy",
    desc: "Forwards incoming calls when your line is engaged or rejected.",
  },
  bsnl: {
    name: "BSNL (India)",
    prefix: "*67*",
    suffix: "#",
    label: "Call Forwarding When Busy",
    desc: "Telecom standard conditional forwarding for BSNL mobile.",
  },
  att: {
    name: "AT&T / US Carriers",
    prefix: "*21*",
    suffix: "#",
    label: "Standard Forwarding",
    desc: "Direct carrier routing code for North American mobile subscribers.",
  },
  verizon: {
    name: "Verizon (USA)",
    prefix: "*71",
    suffix: "",
    label: "Conditional Call Forwarding",
    desc: "No-answer and busy call forwarding to your virtual receptionist.",
  },
};

const VANIEDGE_RECEPTIONIST_PHONE = "+18149613703";

export default function ReceptionistOnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Business Identity
  const [selectedIndustry, setSelectedIndustry] = useState<string>("clinic");
  const [businessName, setBusinessName] = useState<string>("CarePlus Healthcare & Clinics");
  const [operatingHours, setOperatingHours] = useState<string>("Mon-Sat 9:00 AM - 8:00 PM");
  const [emergencyPhone, setEmergencyPhone] = useState<string>("+91 63612 09256");

  // Step 2: Voice Persona
  const [selectedVoice, setSelectedVoice] = useState<string>("sarah");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en-IN");
  const [greetingText, setGreetingText] = useState<string>(INDUSTRY_PRESETS[0].defaultGreeting);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Step 3: Services & Knowledge Base
  const [services, setServices] = useState<ServiceItem[]>(INDUSTRY_PRESETS[0].defaultServices);
  const [newServiceName, setNewServiceName] = useState<string>("");
  const [newServicePrice, setNewServicePrice] = useState<string>("");
  const [newServiceDuration, setNewServiceDuration] = useState<string>("30 mins");
  const [cancellationPolicy, setCancellationPolicy] = useState<string>("Free cancellation up to 2 hours before scheduled time.");

  // Step 4: Carrier Connection
  const [selectedCarrier, setSelectedCarrier] = useState<string>("jio");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Step 5: Test & Launch
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>("+91 63612 09256");
  const [isCallingTest, setIsCallingTest] = useState<boolean>(false);
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const [testCallSid, setTestCallSid] = useState<string | null>(null);

  // Synchronize defaults on industry change
  const handleSelectIndustry = (industryId: string) => {
    setSelectedIndustry(industryId);
    const preset = INDUSTRY_PRESETS.find((p) => p.id === industryId);
    if (preset) {
      setBusinessName(preset.defaultName);
      setGreetingText(preset.defaultGreeting);
      setSelectedVoice(preset.recommendedVoice);
      setServices(preset.defaultServices);
    }
  };

  // Preview Greeting with Web Speech Synthesis
  const handlePlayGreeting = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(greetingText);
    utterance.lang = selectedLanguage;
    utterance.rate = 0.95;
    utterance.pitch = selectedVoice === "sarah" ? 1.05 : selectedVoice === "bella" ? 1.15 : 0.9;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  // Add Service Item
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const newItem: ServiceItem = {
      id: Date.now().toString(),
      name: newServiceName.trim(),
      price: newServicePrice.trim() || "Free",
      duration: newServiceDuration.trim() || "30 mins",
    };
    setServices([...services, newItem]);
    setNewServiceName("");
    setNewServicePrice("");
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  // Compute MMI Forwarding string
  const carrierInfo = CARRIER_FORWARDING_CODES[selectedCarrier] || CARRIER_FORWARDING_CODES.jio;
  const mmiCode = `${carrierInfo.prefix}${VANIEDGE_RECEPTIONIST_PHONE}${carrierInfo.suffix}`;

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(mmiCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Trigger Outbound Live Test Call
  const handleDispatchTestCall = async () => {
    if (!testPhoneNumber.trim()) return;
    setIsCallingTest(true);
    setTestCallStatus("Initiating carrier SIP call bridge...");
    setTestCallSid(null);

    try {
      const res = await fetch("/api/voice/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testPhoneNumber.trim(),
          callerName: businessName,
          category: selectedIndustry,
          voice: selectedVoice,
        }),
      });

      const data = (await res.json()) as { success?: boolean; callSid?: string; error?: string };
      if (res.ok && data.success) {
        setTestCallSid(data.callSid || "CA_live_test_call");
        setTestCallStatus("Ringing your phone now! Please answer to speak with your AI receptionist.");
      } else {
        setTestCallStatus(data.error || "Unable to dispatch call. Please verify your phone number format (+91...).");
      }
    } catch {
      setTestCallStatus("Network error connecting to telephony gateway.");
    } finally {
      setIsCallingTest(false);
    }
  };

  // Save Configuration & Proceed to Dashboard
  const handleCompleteOnboarding = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "vaniedge_receptionist_config",
          JSON.stringify({
            businessName,
            selectedIndustry,
            operatingHours,
            emergencyPhone,
            selectedVoice,
            selectedLanguage,
            greetingText,
            services,
            cancellationPolicy,
            selectedCarrier,
            forwardingNumber: VANIEDGE_RECEPTIONIST_PHONE,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    } catch {
      // Storage quota or disabled
    }
    router.push("/receptionist");
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-white selection:bg-emerald-500/30 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0d0d12]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/receptionist" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-black font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <PhoneCall className="w-5 h-5 text-black" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="font-bold font-oswald text-lg tracking-wider text-white uppercase">
                  VANIEDGE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  60S ONBOARDING
                </span>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                AI Voice Receptionist Quick Setup
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/receptionist"
              className="text-xs font-mono text-gray-400 hover:text-white transition-colors"
            >
              Skip to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Progress Stepper Bar */}
        <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase text-emerald-400 tracking-wider font-semibold">
              Step {currentStep} of 5
            </span>
            <span className="text-xs font-mono text-gray-400">
              {currentStep === 1 && "Business Profile"}
              {currentStep === 2 && "Voice Persona"}
              {currentStep === 3 && "Services & FAQ"}
              {currentStep === 4 && "Carrier Forwarding"}
              {currentStep === 5 && "Test & Launch"}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep >= stepNum
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: Business Profile */}
        {currentStep === 1 && (
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-2xl font-bold font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                <Building className="w-6 h-6 text-emerald-400" />
                Select Your Business Industry & Name
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Your AI receptionist is tuned specifically for your industry's appointment flows, terminology, and customer questions.
              </p>
            </div>

            {/* Industry Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INDUSTRY_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectIndustry(item.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedIndustry === item.id
                      ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(52,211,153,0.15)] ring-1 ring-emerald-500/40"
                      : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div>
                    <h4 className="font-oswald uppercase font-bold text-sm text-white">{item.name}</h4>
                    <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                      Voice: {item.recommendedVoice}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Business Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                  Business Name (Announced to Callers)
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60"
                  placeholder="e.g. CarePlus Healthcare & Clinics"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60"
                  placeholder="e.g. Mon-Sat 9:00 AM - 8:00 PM"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                  Emergency / Duty Staff Phone
                </label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60 font-mono"
                  placeholder="+91 63612 09256"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Critical medical or towing calls will warm-transfer directly to this line.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Next: Voice Persona</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Voice Persona */}
        {currentStep === 2 && (
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-2xl font-bold font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                <Volume2 className="w-6 h-6 text-emerald-400" />
                Configure Voice Persona & Greeting
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Choose the voice that best represents your brand's tone. Preview it with one click before publishing.
              </p>
            </div>

            {/* Voice Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "sarah", name: "Sarah", desc: "Warm, empathetic & comforting", tag: "Healthcare" },
                { id: "bella", name: "Bella", desc: "Polite, upbeat & vibrant", tag: "Hospitality" },
                { id: "matthew", name: "Matthew", desc: "Clear, authoritative & precise", tag: "Legal/Realty" },
                { id: "joanna", name: "Joanna", desc: "Fast-paced & efficient", tag: "Dispatch" },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVoice(v.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedVoice === v.id
                      ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(52,211,153,0.15)] ring-1 ring-emerald-500/40"
                      : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-emerald-300 font-bold block w-fit mb-2">
                      {v.tag}
                    </span>
                    <h4 className="font-oswald uppercase font-bold text-base text-white">{v.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{v.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                Primary Telephony Speech Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full sm:w-80 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60"
              >
                <option value="en-IN" className="bg-[#111]">English (India) — en-IN</option>
                <option value="hi-IN" className="bg-[#111]">Hindi (हिंदी) — hi-IN</option>
                <option value="kn-IN" className="bg-[#111]">Kannada (ಕನ್ನಡ) — kn-IN</option>
                <option value="mr-IN" className="bg-[#111]">Marathi (मराठी) — mr-IN</option>
                <option value="ta-IN" className="bg-[#111]">Tamil (தமிழ்) — ta-IN</option>
                <option value="en-US" className="bg-[#111]">English (US) — en-US</option>
                <option value="es-ES" className="bg-[#111]">Spanish (Español) — es-ES</option>
              </select>
            </div>

            {/* Customizable Opening Greeting */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono uppercase text-gray-400">
                  Opening Call Greeting
                </label>
                <button
                  type="button"
                  onClick={handlePlayGreeting}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 ${isPlayingAudio ? "animate-spin" : ""}`} />
                  <span>{isPlayingAudio ? "Playing Audio..." : "Preview Greeting"}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={greetingText}
                onChange={(e) => setGreetingText(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-emerald-500/60 leading-relaxed font-sans"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                This exact greeting is spoken to the caller within 380ms of answering the call.
              </span>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-oswald uppercase text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Next: Services &amp; FAQ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Services & Knowledge Base */}
        {currentStep === 3 && (
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-2xl font-bold font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                <Sliders className="w-6 h-6 text-emerald-400" />
                Services, Pricing &amp; Knowledge Base
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Your AI receptionist references this knowledge in real time via SutraDB (&lt;5ms) to answer caller questions and book slots accurately.
              </p>
            </div>

            {/* Services List Table */}
            <div className="space-y-3">
              <label className="block text-xs font-mono uppercase text-gray-400">
                Active Bookable Services
              </label>

              <div className="space-y-2">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-medium text-white">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-emerald-400 text-xs font-semibold">{svc.price}</span>
                      <span className="font-mono text-gray-400 text-xs">{svc.duration}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(svc.id)}
                        className="text-gray-500 hover:text-red-400 text-xs font-mono transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Service Form */}
              <form onSubmit={handleAddService} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Service Name (e.g. Consultation)"
                  className="sm:col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                />
                <input
                  type="text"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder="Price (e.g. ₹500)"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  type="submit"
                  className="bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 text-xs font-oswald uppercase tracking-wider font-bold transition-colors cursor-pointer"
                >
                  + Add Service
                </button>
              </form>
            </div>

            {/* Cancellation Policy */}
            <div className="pt-4 border-t border-white/10">
              <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                Cancellation &amp; Rescheduling Policy
              </label>
              <input
                type="text"
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60"
                placeholder="e.g. Free cancellation up to 2 hours before scheduled slot"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-oswald uppercase text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Next: Carrier Forwarding</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Carrier Conditional Forwarding */}
        {currentStep === 4 && (
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero Number Porting Required</span>
              </div>
              <h2 className="text-2xl font-bold font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-emerald-400" />
                Connect Your Existing Business Phone Number
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Keep your existing SIM and phone number. Using telecom conditional forwarding, your carrier forwards calls to VaniEdge only when you're busy or away.
              </p>
            </div>

            {/* Carrier Selector Buttons */}
            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-2">
                Select Your Mobile Operator / Carrier
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(CARRIER_FORWARDING_CODES).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCarrier(key)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedCarrier === key
                        ? "bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                        : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="font-oswald uppercase font-bold text-sm text-white block">
                      {item.name}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 block mt-0.5">
                      Code: {item.prefix}...{item.suffix}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* MMI Code Box */}
            <div className="p-5 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase text-gray-400">
                  {carrierInfo.label} Dial String:
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  {carrierInfo.desc}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg font-bold text-emerald-300 tracking-wider">
                  {mmiCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-oswald uppercase text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                </button>
                <a
                  href={`tel:${mmiCode}`}
                  className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span className="hidden sm:inline">Tap to Dial</span>
                </a>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                👉 <strong>How it works:</strong> Dialing this code instructs your carrier to redirect incoming callers to your AI Receptionist (<code className="text-white">{VANIEDGE_RECEPTIONIST_PHONE}</code>) only if you don't answer within 15 seconds or your line is busy. To cancel anytime, simply dial <code className="text-white">##002#</code>.
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-oswald uppercase text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Next: Test &amp; Launch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Test & Launch */}
        {currentStep === 5 && (
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-2xl font-bold font-oswald uppercase tracking-wider text-white flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                Ready to Launch! Test Your AI Receptionist
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Your AI receptionist is fully configured. Trigger a live call to your personal mobile right now to experience how callers will be greeted.
              </p>
            </div>

            {/* Test Call Box */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-black to-[#0f0f15] border border-emerald-500/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <PhoneCall className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-oswald uppercase font-bold text-base text-white">
                    Live Phone Call Verification
                  </h4>
                  <p className="text-xs text-gray-400">
                    Incoming calls in India are 100% free (zero ISD pack required).
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="+91 63612 09256"
                  className="w-full sm:w-72 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  type="button"
                  disabled={isCallingTest}
                  onClick={handleDispatchTestCall}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-black hover:bg-gray-200 font-oswald uppercase text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>{isCallingTest ? "Dispatching..." : "Dispatch Live Test Call"}</span>
                </button>
              </div>

              {testCallStatus && (
                <div className="p-3.5 rounded-xl bg-black/60 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{testCallStatus}</span>
                  {testCallSid && <span className="opacity-60 text-[10px]">({testCallSid})</span>}
                </div>
              )}
            </div>

            {/* Summary Review Card */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-gray-500 uppercase block">Business</span>
                <span className="text-white font-semibold truncate block mt-0.5">{businessName}</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase block">Persona Voice</span>
                <span className="text-emerald-400 font-semibold uppercase block mt-0.5">{selectedVoice}</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase block">Services</span>
                <span className="text-white font-semibold block mt-0.5">{services.length} items</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase block">Forward Line</span>
                <span className="text-cyan-400 font-semibold block mt-0.5">{VANIEDGE_RECEPTIONIST_PHONE}</span>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-oswald uppercase text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-oswald uppercase text-base font-bold flex items-center gap-2 shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-black" />
                <span>Save &amp; Open Receptionist Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
