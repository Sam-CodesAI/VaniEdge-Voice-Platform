"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Bot,
  Building2,
  Clock,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  Globe2,
  FileText,
  ShieldCheck,
  Send,
} from "lucide-react";
import { BusinessCategory, AVAILABLE_CATEGORIES } from "./VaniStudioView";

interface VerticalCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployToStudio: (config: {
    category: BusinessCategory;
    businessName: string;
    language: string;
    operatingHours: string;
    servicesText: string;
  }) => void;
}

export default function VerticalCustomizerModal({
  isOpen,
  onClose,
  onDeployToStudio,
}: VerticalCustomizerModalProps) {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory>("clinic");
  const [businessName, setBusinessName] = useState<string>("Dr. Sharma Healthcare & Clinic");
  const [operatingHours, setOperatingHours] = useState<string>("9:00 AM - 8:30 PM (Mon - Sat)");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("hi");
  const [servicesText, setServicesText] = useState<string>(
    "General Consultation: ₹500, Specialist Cardiology: ₹900, Walk-in Triage accepted until 7 PM."
  );
  const [escalationPhone, setEscalationPhone] = useState<string>("+91 98450 12345");

  if (!isOpen) return null;

  const handleNext = () => setStep((prev) => Math.min(prev + 1, 4));
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleFinishDeploy = async () => {
    setIsSubmitting(true);
    try {
      // Fire lead capture & Telegram push notification asynchronously
      void fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "LEAD_CUSTOMIZER",
          businessName,
          category: selectedCategory,
          language: selectedLanguage,
          contact: escalationPhone,
          details: `Hours: ${operatingHours} | Services: ${servicesText}`,
        }),
      });
    } catch {
      // Non-blocking
    } finally {
      setIsSubmitting(false);
      setStep(4);
    }
  };

  const handleLaunchStudio = () => {
    onDeployToStudio({
      category: selectedCategory,
      businessName,
      language: selectedLanguage,
      operatingHours,
      servicesText,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border-2 border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto text-black">
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-black hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header in Oswald & Black Text */}
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-black text-xs font-oswald uppercase font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>60-SECOND AGENT CUSTOMIZER WIZARD</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-black font-oswald uppercase">
            Tailor Your 24/7 Autonomous Voice Receptionist
          </h2>
          <p className="text-xs sm:text-sm text-black font-medium mt-1">
            Configure your brand, services, operating hours, and Indic language model in 3 simple steps.
          </p>
        </div>

        {/* Step Progression Bar */}
        <div className="grid grid-cols-4 gap-2">
          <div
            className={`h-2 rounded-full transition-all ${
              step >= 1 ? "bg-black" : "bg-slate-200"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              step >= 2 ? "bg-black" : "bg-slate-200"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              step >= 3 ? "bg-black" : "bg-slate-200"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              step >= 4 ? "bg-emerald-600" : "bg-slate-200"
            }`}
          />
        </div>

        {/* STEP 1: BUSINESS IDENTITY & CATEGORY */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-black font-oswald uppercase mb-1.5">
                1. Your Business or Practice Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Apex Health Clinic, Royal Biryani Express..."
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:border-black font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black font-oswald uppercase mb-2">
                2. Select Industry Vertical
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AVAILABLE_CATEGORIES.map((cat) => {
                  const isSel = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isSel
                          ? "bg-emerald-50 border-emerald-600 text-black shadow-md ring-1 ring-emerald-600"
                          : "bg-white border-slate-200 text-black hover:border-slate-400 hover:bg-slate-50 shadow-sm"
                      }`}
                    >
                      <div className="text-xl mb-1">{cat.icon}</div>
                      <div className="text-xs font-bold text-black font-oswald uppercase truncate">{cat.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: OPERATIONAL HOURS & REGIONAL LANGUAGE */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-black font-oswald uppercase mb-1.5">
                1. Business Operating Hours
              </label>
              <input
                type="text"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder="e.g. 9:00 AM - 9:00 PM (Monday - Sunday)"
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:border-black font-medium transition-colors"
              />
              <span className="text-[11px] text-slate-600 mt-1 block font-medium">
                After-hours callers are politely informed of timings and their callback request is logged.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-black font-oswald uppercase mb-1.5">
                2. Primary Voice Dialect
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { code: "hi", label: "हिंदी (Hindi)" },
                  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
                  { code: "en", label: "English (India)" },
                  { code: "mr", label: "मराठी (Marathi)" },
                  { code: "ta", label: "தமிழ் (Tamil)" },
                  { code: "es", label: "Español (Spanish)" },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLanguage(lang.code)}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer text-center ${
                      selectedLanguage === lang.code
                        ? "bg-emerald-500 border-emerald-600 text-black font-oswald"
                        : "bg-white border-slate-200 text-black hover:bg-slate-100"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black font-oswald uppercase mb-1.5">
                3. Manager Escalation Phone (For SMS Alerts)
              </label>
              <input
                type="tel"
                value={escalationPhone}
                onChange={(e) => setEscalationPhone(e.target.value)}
                placeholder="+91 98450 12345"
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:border-black font-mono font-medium transition-colors"
              />
            </div>
          </div>
        )}

        {/* STEP 3: SERVICES, PRICING & DEPLOY */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-black font-oswald uppercase mb-1.5">
                Custom Services, Fees &amp; FAQs for SutraDB
              </label>
              <textarea
                rows={3}
                value={servicesText}
                onChange={(e) => setServicesText(e.target.value)}
                placeholder="List your key offerings, prices, walk-in rules or menu specials..."
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none focus:border-black font-medium transition-colors"
              />
              <span className="text-[11px] text-slate-600 mt-1 block font-medium">
                These rules are vectorized instantly into SutraDB memory for sub-15ms caller retrieval.
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-black font-oswald uppercase text-sm flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Configuration Ready for Live Simulation</span>
              </div>
              <div className="text-black grid grid-cols-2 gap-2 text-xs font-mono font-bold">
                <div>• Brand: <span className="text-black">{businessName}</span></div>
                <div>• Vertical: <span className="text-emerald-700">{selectedCategory}</span></div>
                <div>• Dialect: <span className="text-black">{selectedLanguage.toUpperCase()}</span></div>
                <div>• Hours: <span className="text-black">{operatingHours}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Celebration & Live Activation */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-500 mx-auto flex items-center justify-center text-2xl shadow-sm">
                🎉
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-oswald uppercase text-black">
                {businessName} Voice Receptionist Is Provisioned!
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-lg mx-auto">
                Your custom service offerings, operating hours, and SutraDB vector memory are loaded and ready to answer calls 24/7 with zero dropped calls.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-200 space-y-1.5">
                <span className="font-bold text-black uppercase font-oswald tracking-wide flex items-center gap-1.5 text-xs">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  Live PSTN Carrier Test Line
                </span>
                <p className="font-mono font-bold text-sm text-black">+1 (814) 961-3703</p>
                <p className="text-[11px] text-slate-500 font-medium">Dial from any standard phone to test our carrier stream live.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-200 space-y-1.5">
                <span className="font-bold text-black uppercase font-oswald tracking-wide flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Missed Call Forwarding Code
                </span>
                <p className="font-mono font-bold text-sm text-emerald-800">*71*+18149613703</p>
                <p className="text-[11px] text-slate-500 font-medium">Enter this code on your phone to forward unanswered calls to your AI receptionist.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-blue-950 font-oswald uppercase text-sm">Want Dedicated SIP Numbers &amp; Multi-Tenant Setup?</p>
                <p className="text-blue-800 text-[11px]">Book a 15-minute deployment call or connect directly with our engineering desk.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="https://cal.com/sam-codesai/15min"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold font-oswald uppercase text-xs transition-colors flex items-center gap-1.5"
                >
                  <span>Book Setup Call</span>
                </a>
                <a
                  href="https://t.me/Samarth1306"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-white border border-blue-300 text-blue-900 hover:bg-blue-100 font-bold font-oswald uppercase text-xs transition-colors"
                >
                  Telegram
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {step > 1 && step < 4 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-black text-xs font-oswald uppercase font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white font-bold font-oswald uppercase text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : step === 3 ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinishDeploy}
                className="px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white font-bold font-oswald uppercase text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>{isSubmitting ? "Provisioning..." : "Provision & Activate"}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLaunchStudio}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-oswald uppercase text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ml-auto"
            >
              <Bot className="w-4 h-4" />
              <span>Test Voice Call in Studio Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
