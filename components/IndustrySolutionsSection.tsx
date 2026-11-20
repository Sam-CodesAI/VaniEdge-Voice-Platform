"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  UtensilsCrossed,
  Truck,
  ShoppingBag,
  Home,
  CreditCard,
  Hotel,
  Headphones,
  PhoneCall,
} from "lucide-react";
import { AVAILABLE_CATEGORIES, BusinessCategory } from "./VaniStudioView";

interface IndustrySolutionsSectionProps {
  onSelectCategory: (id: BusinessCategory) => void;
}

export default function IndustrySolutionsSection({
  onSelectCategory,
}: IndustrySolutionsSectionProps) {
  const [activeTab, setActiveTab] = useState<BusinessCategory>("clinic");

  const categoryDetails: Record<
    BusinessCategory,
    {
      iconComp: React.ReactNode;
      headline: string;
      capabilities: string[];
      roiMetric: string;
      sampleDialogue: { user: string; agent: string };
    }
  > = {
    clinic: {
      iconComp: <Building2 className="w-5 h-5 text-emerald-400" />,
      headline: "Healthcare Triage & Patient Slot Scheduling",
      capabilities: [
        "Patient symptom intake & urgency triage",
        "Automated doctor slot booking with 1-hr advance confirmation",
        "Transparent consultation fee & emergency contact broadcast",
        "Zero hold-time receptionist answering during peak surgery hours",
      ],
      roiMetric: "82% reduction in clinic receptionist overhead",
      sampleDialogue: {
        user: "Doctor, can I get an appointment with the pediatrician for tomorrow at 11am?",
        agent: "Namaste! Dr. Sharma has open slots tomorrow at 11:00 AM or 12:30 PM. Shall I confirm 11:00 AM for you? I will also send an instant SMS confirmation.",
      },
    },
    restaurant: {
      iconComp: <UtensilsCrossed className="w-5 h-5 text-amber-400" />,
      headline: "Dining Reservations & Takeaway Orders",
      capabilities: [
        "Table reservations with party size & indoor/outdoor seating choices",
        "Direct menu item order intake with live item stock verification",
        "Delivery address & landmark extraction with phonetic street parsing",
        "Instant WhatsApp/SMS order tracking link dispatch",
      ],
      roiMetric: "100% elimination of missed orders during busy dinner rushes",
      sampleDialogue: {
        user: "I want to reserve a table for 4 people tonight around 8pm.",
        agent: "We would love to host you! We have an indoor table for 4 at 8:00 PM tonight at Royal Feast Bistro. May I have your name to confirm?",
      },
    },
    auto: {
      iconComp: <Truck className="w-5 h-5 text-cyan-400" />,
      headline: "24/7 Roadside Rescue & Service Dispatch",
      capabilities: [
        "Immediate emergency triage for highway breakdowns and flat tires",
        "Accurate highway milestone, GPS & landmark caller extraction",
        "Automatic SMS tracking link with tow truck driver live telemetry",
        "Transparent upfront pricing without roadside price gouging",
      ],
      roiMetric: "<45s dispatch initiation from phone pickup to driver assignment",
      sampleDialogue: {
        user: "My car engine stopped on the highway near the airport toll!",
        agent: "Stay safe inside the vehicle. I am dispatching our nearest flatbed tow truck to your location right now. ETA is 14 minutes.",
      },
    },
    retail: {
      iconComp: <ShoppingBag className="w-5 h-5 text-purple-400" />,
      headline: "Store Inventory, Curbside Pickup & Inquiries",
      capabilities: [
        "Real-time inventory lookup across retail SKU catalogs",
        "Order status checks with tracking numbers and ETA updates",
        "Return policy guidelines & store operating hours answering",
        "Curbside pickup coordination when customers pull into parking",
      ],
      roiMetric: "65% deflection of repetitive order status inquiries",
      sampleDialogue: {
        user: "Do you have the organic almond butter in stock at your Indiranagar store?",
        agent: "Yes, we currently have 8 jars of organic almond butter in stock at Indiranagar. Would you like me to hold one for curbside pickup?",
      },
    },
    realestate: {
      iconComp: <Home className="w-5 h-5 text-blue-400" />,
      headline: "Property Viewing Tours & Tenant Pre-Screening",
      capabilities: [
        "Automated site visit scheduling for residential & commercial units",
        "Pre-screening buyer budget, preferred move-in dates & unit types",
        "Instant rental pricing, security deposit, and floor-plan SMS delivery",
        "Warm transfer to assigned listing agent for high-intent buyers",
      ],
      roiMetric: "3.4x higher viewing tour conversion rates",
      sampleDialogue: {
        user: "Is the 3BHK penthouse at Prestige Heights still available for a visit this weekend?",
        agent: "Yes, the 3BHK penthouse is available. I can schedule a private guided walkthrough on Saturday at 11:30 AM or 3:00 PM. Which works best?",
      },
    },
    finance: {
      iconComp: <CreditCard className="w-5 h-5 text-emerald-400" />,
      headline: "Branch Appointments & Loan Inquiry Screening",
      capabilities: [
        "Personal loan, home mortgage, and credit card inquiry qualification",
        "Branch visit scheduling with specialist wealth advisors",
        "Document checklist dispatch via encrypted SMS",
        "Strict adherence to financial privacy regulations and PII protection",
      ],
      roiMetric: "40% faster loan pre-qualification pipeline",
      sampleDialogue: {
        user: "What are the required documents for applying for a new business expansion loan?",
        agent: "For a business loan, you will need 2 years of audited ITRs, 6 months bank statements, and GST returns. I have sent the checklist to your phone.",
      },
    },
    hospitality: {
      iconComp: <Hotel className="w-5 h-5 text-rose-400" />,
      headline: "Room Reservations, Amenities & Concierge",
      capabilities: [
        "Direct hotel room booking with date & occupancy selection",
        "Airport shuttle transfer coordination and baggage inquiries",
        "Room service order taking and spa appointment reservations",
        "Automated booking confirmation with reservation PIN via SMS",
      ],
      roiMetric: "18% increase in direct commission-free telephone bookings",
      sampleDialogue: {
        user: "Do you have a suite available with sea view for this coming Friday night?",
        agent: "We have our Deluxe Sea View Suite available for Friday night. It includes complimentary breakfast and airport pickup. Would you like to reserve it?",
      },
    },
    general: {
      iconComp: <Headphones className="w-5 h-5 text-indigo-400" />,
      headline: "Enterprise Front Desk & Reception Concierge",
      capabilities: [
        "Smart department routing with phonetic employee name resolution",
        "After-hours voicemail transcription with priority Telegram alerts",
        "Automated CRM ticket logging with audio snippet attachments",
        "Multi-lingual operator support for pan-regional customer bases",
      ],
      roiMetric: "Zero unanswered inbound business inquiries",
      sampleDialogue: {
        user: "Can I speak to someone in enterprise partnerships?",
        agent: "Certainly! I have recorded your enterprise inquiry and notified our partnerships director. You will receive an immediate callback within 15 minutes.",
      },
    },
  };

  const activeData = categoryDetails[activeTab];

  return (
    <section id="industries" className="py-20 sm:py-28 border-t border-b border-white/10 bg-[#07070a] text-white relative font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-emerald-400 text-xs font-oswald uppercase tracking-wider font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>TURNKEY VERTICAL RECEPTIONISTS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white font-oswald uppercase tracking-tight">
            Tailored Voice AI for Every Industry
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400 font-normal max-w-2xl mx-auto leading-relaxed">
            Pre-trained on industry vocabulary, specialized appointment workflows, and localized regional compliance rules.
          </p>
        </div>

        {/* Industry Pill Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {AVAILABLE_CATEGORIES.map((cat) => {
            const isSelected = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? "bg-emerald-500/15 text-white border-emerald-500/60 shadow-[0_0_20px_rgba(52,211,153,0.15)] ring-1 ring-emerald-500/40"
                    : "bg-white/[0.02] text-gray-300 border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-2xl shrink-0">{cat.icon}</span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-bold text-white text-xs font-oswald uppercase">
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate font-normal">
                    {cat.shortDesc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Industry Deep-Dive Card */}
        <div className="rounded-2xl bg-[#0c0c14] border border-white/10 p-6 sm:p-10 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  {activeData.iconComp}
                </div>
                <div>
                  <span className="text-xs font-mono uppercase text-emerald-400 tracking-wider font-bold block">
                    Turnkey Industry Agent
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white font-oswald uppercase">
                    {activeData.headline}
                  </h3>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {activeData.capabilities.map((cap, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-sm text-gray-300 font-normal">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-emerald-300 text-xs font-mono">
                  📈 Business Impact: {activeData.roiMetric}
                </div>
                <Link
                  href="/receptionist/onboarding"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-oswald uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Launch {activeTab.toUpperCase()} Receptionist</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Dialogue Preview Mockup */}
            <div className="lg:col-span-5 bg-black/50 border border-white/10 rounded-2xl p-5 space-y-3 font-sans shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Call Audio Preview
                </span>
                <span className="text-gray-400">Latency: 3.8ms</span>
              </div>

              <div className="space-y-3 pt-1">
                {/* Caller Message */}
                <div className="flex items-start gap-2 text-xs">
                  <div className="h-6 w-6 rounded-full bg-white/10 text-gray-300 flex items-center justify-center font-bold font-oswald text-[10px] shrink-0 mt-0.5">
                    Caller
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 leading-relaxed flex-1 font-normal">
                    "{activeData.sampleDialogue.user}"
                  </div>
                </div>

                {/* VaniEdge Agent Message */}
                <div className="flex items-start gap-2 text-xs">
                  <div className="h-6 w-6 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold font-oswald text-[10px] shrink-0 mt-0.5">
                    Vani
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 leading-relaxed flex-1 font-normal">
                    "{activeData.sampleDialogue.agent}"
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
