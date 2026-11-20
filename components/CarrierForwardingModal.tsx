"use client";

import React, { useState } from "react";
import {
  X,
  PhoneCall,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  HelpCircle,
  Smartphone,
  ArrowRight,
  Sparkles,
  Radio,
} from "lucide-react";
import CarrierPhone3DSimulator from "./CarrierPhone3DSimulator";

interface CarrierForwardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPhone?: string;
}

interface CarrierGuide {
  carrier: string;
  country: string;
  tag: string;
  enableCode: string;
  disableCode: string;
  notes: string;
}

const CARRIERS: CarrierGuide[] = [
  {
    carrier: "Reliance Jio",
    country: "India",
    tag: "Top Indian VoLTE",
    enableCode: "*409*",
    disableCode: "*410",
    notes: "Conditional forward when unanswered/busy: dial *409* followed by 10-digit number. For 24/7 unconditional forward, use *401*. Cancel with *410.",
  },
  {
    carrier: "Bharti Airtel",
    country: "India",
    tag: "Top Indian 4G/5G",
    enableCode: "*71*",
    disableCode: "*70",
    notes: "Conditional forward when unreachable or busy: dial *71* followed by 10-digit number. Cancel anytime by dialing *70 or ##002#.",
  },
  {
    carrier: "Vodafone Idea (Vi)",
    country: "India",
    tag: "GSM Standard",
    enableCode: "**61*<number>#",
    disableCode: "##002#",
    notes: "Standard GSM call forward when no answer. Cancel all forwards with ##002#.",
  },
  {
    carrier: "BSNL",
    country: "India",
    tag: "National Carrier",
    enableCode: "*21*",
    disableCode: "##21#",
    notes: "Standard call forward on BSNL lines. Dial *21* followed by phone number and press call. Cancel with ##21#.",
  },
  {
    carrier: "Verizon Wireless",
    country: "USA",
    tag: "Most Popular US",
    enableCode: "*71",
    disableCode: "*73",
    notes: "Dials *71 followed by the 10-digit number. Forwards only when unanswered or line is busy.",
  },
  {
    carrier: "AT&T",
    country: "USA",
    tag: "US Nationwide",
    enableCode: "*71",
    disableCode: "*720",
    notes: "Activates conditional no-answer / busy forwarding. To cancel anytime, dial *720 or *73.",
  },
  {
    carrier: "T-Mobile",
    country: "USA",
    tag: "GSM Standard",
    enableCode: "**61*<number>#",
    disableCode: "##004#",
    notes: "Standard GSM conditional forward. Dial ##004# to cancel all forward rules.",
  },
];

export default function CarrierForwardingModal({
  isOpen,
  onClose,
  targetPhone = "+18149613703",
}: CarrierForwardingModalProps) {
  const [selectedCarrierIndex, setSelectedCarrierIndex] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);
  const [modalViewMode, setModalViewMode] = useState<"guide" | "3d_simulator">("guide");

  if (!isOpen) return null;

  const currentCarrier = CARRIERS[selectedCarrierIndex];
  const cleanTarget = targetPhone.replace(/\D/g, "");

  // Generate exact dialable string
  const formatDialString = (template: string) => {
    if (template.includes("<number>")) {
      return template.replace("<number>", targetPhone);
    }
    return `${template}${targetPhone}`;
  };

  const dialString = formatDialString(currentCarrier.enableCode);

  const handleCopy = (text: string, isCode: boolean) => {
    navigator.clipboard.writeText(text);
    if (isCode) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full ${
          modalViewMode === "3d_simulator" ? "max-w-4xl" : "max-w-2xl"
        } bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300`}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-blue-950/30 to-purple-950/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-oswald uppercase tracking-wide text-white">
                Connect Your Existing Business Phone
              </h3>
              <p className="text-xs text-gray-400">
                Zero porting required. Keep your current number &amp; carrier.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setModalViewMode("guide")}
                className={`px-3 py-1 text-xs font-oswald uppercase rounded-lg font-bold transition-all cursor-pointer ${
                  modalViewMode === "guide"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Setup Guide
              </button>
              <button
                type="button"
                onClick={() => setModalViewMode("3d_simulator")}
                className={`px-3 py-1 text-xs font-oswald uppercase rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  modalViewMode === "3d_simulator"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>3D Simulator</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Switch between 3D Simulator and Step-by-Step Guide */}
        {modalViewMode === "3d_simulator" ? (
          <div className="p-4 sm:p-6 overflow-y-auto">
            <CarrierPhone3DSimulator targetPhone={targetPhone} />
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 text-sm">
            {/* Explanation Banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200/90 leading-relaxed">
                <strong className="text-white">How Conditional Forwarding Works:</strong> Your business phone rings
                normally for 3–4 rings. If you or your staff cannot pick up, your mobile carrier automatically forwards
                the caller to VaniEdge Voice AI within 18ms. You never miss a paying customer or emergency inquiry again.
              </div>
            </div>

            {/* Step 1: Target Inbound Number */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Step 1: Your Dedicated VaniEdge Forwarding Number
              </label>
              <div className="flex items-center justify-between p-3.5 bg-black/60 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono text-base font-bold text-white tracking-wider">
                      {targetPhone}
                    </span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Live PSTN Ready
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(targetPhone, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors cursor-pointer"
                >
                  {copiedNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedNumber ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Step 2: Select Carrier */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Step 2: Select Your Phone Carrier
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARRIERS.map((c, idx) => (
                  <button
                    key={c.carrier}
                    type="button"
                    onClick={() => setSelectedCarrierIndex(idx)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedCarrierIndex === idx
                        ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg shadow-blue-500/10"
                        : "bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{c.carrier}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                        {c.country}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{c.tag}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Activation Code & Instruction */}
            <div className="p-4 bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">
                  Dial this code from your {currentCarrier.carrier} phone:
                </span>
                <span className="text-[10px] text-gray-400">Takes 5 seconds</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/80 border border-blue-500/30 rounded-lg">
                <span className="font-mono text-sm md:text-base font-bold text-blue-400 tracking-wider">
                  {dialString}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(dialString, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? "Copied" : "Copy Code"}
                </button>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                {currentCarrier.notes}
              </p>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                <span>To disable / cancel forwarding anytime:</span>
                <span className="font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                  {currentCarrier.disableCode}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer CTAs */}
        <div className="p-5 border-t border-white/10 bg-black/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href={`tel:${targetPhone}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/10 transition-colors"
          >
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            Place Test Call ({targetPhone})
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="https://t.me/Samarth1306"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-lg shadow-blue-600/20"
            >
              Assisted Setup on Telegram
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
