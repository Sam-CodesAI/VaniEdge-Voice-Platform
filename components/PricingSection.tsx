"use client";

import React, { useState } from "react";
import { Check, Sparkles, Phone, ArrowRight, ShieldCheck, Zap, CreditCard } from "lucide-react";

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState<boolean>(true);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const plans = [
    {
      name: "Local Starter",
      badge: "Single Location",
      monthlyPriceUSD: 49,
      annualPriceUSD: 39,
      monthlyPriceINR: 2999,
      annualPriceINR: 2499,
      description: "Ideal for clinics, cloud kitchens, and local service providers replacing voicemail.",
      features: [
        "1 Dedicated Inbound Telephony Number",
        "500 Minutes Voice AI Handling / month",
        "Sub-12ms SutraDB Local Vector Memory",
        "All 8 Turnkey Industry Personas",
        "Automated Multi-Lingual SMS Dispatch",
        "Web Telephony Studio & Voice Orb Access",
        "UPI & Instant QR Payment Ready",
        "Standard Community Support",
      ],
      ctaText: "Deploy Starter Line",
      ctaLink: "https://t.me/Samarth1306?text=Hi%20Samarth,%20I%20want%20to%20deploy%20the%20VaniEdge%20Starter%20plan.",
      highlight: false,
    },
    {
      name: "Growth Business",
      badge: "Most Popular",
      monthlyPriceUSD: 149,
      annualPriceUSD: 119,
      monthlyPriceINR: 8999,
      annualPriceINR: 7199,
      description: "For busy clinics, automotive rescue dispatchers, and growing restaurant chains.",
      features: [
        "3 Dedicated Inbound Telephony Numbers",
        "2,500 Minutes Voice AI Handling / month",
        "Sub-1,200ms Telephony Failover Watchdog",
        "Zero-Dropped-Calls Carrier Guarantee",
        "Custom SutraDB Domain Knowledge Ingestion",
        "Full Indic Regional Multi-Lingual Engine",
        "Custom ElevenLabs Voice Model Cloning",
        "Exotel & Airtel IQ SIP Trunk Interconnect",
        "Direct Priority Telegram Channel Support",
      ],
      ctaText: "Claim Growth Suite",
      ctaLink: "https://t.me/Samarth1306?text=Hi%20Samarth,%20I%20want%20the%20VaniEdge%20Growth%20Business%20plan%20with%20Failover.",
      highlight: true,
    },
    {
      name: "Enterprise Carrier",
      badge: "High Availability",
      monthlyPriceUSD: 499,
      annualPriceUSD: 399,
      monthlyPriceINR: 29999,
      annualPriceINR: 23999,
      description: "For high-volume contact centers, hotel chains, and multi-state enterprise dispatch.",
      features: [
        "Unlimited SIP Trunking & Phone Numbers",
        "10,000+ Minutes High-Concurrency Quota",
        "Multi-Region Edge Failover Mesh",
        "Dedicated Carrier Interconnect Bridge",
        "Custom CRM & POS Two-Way Webhook Integration",
        "99.99% Guaranteed SLA Uptime Contract",
        "GST Invoicing & Priority Billing Support",
        "Dedicated Solutions Engineer & Custom Models",
      ],
      ctaText: "Contact Enterprise Desk",
      ctaLink: "https://t.me/Samarth1306?text=Hi%20Samarth,%20I%20need%20the%20VaniEdge%20Enterprise%20Carrier%20infrastructure.",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-16 sm:py-24 border-b border-slate-200 bg-slate-50/60 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header in Oswald with Black Text */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-100 border border-slate-300 text-black text-xs font-oswald uppercase tracking-wider font-bold mb-3">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>TRANSPARENT 2026 COMMERCIAL TIERS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-black font-oswald uppercase tracking-tight">
            Transparent Pricing. Zero Hidden Fees.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-black font-medium">
            Every plan includes our sub-second telephony runtime, embedded SutraDB vector memory, and multi-lingual dispatch.
          </p>

          {/* Currency and Billing Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {/* Currency Selector */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border-2 border-slate-300 text-xs shadow-sm">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`px-3.5 py-1.5 rounded-lg font-oswald uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  currency === "INR"
                    ? "bg-black text-white shadow-sm"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                🇮🇳 INR (₹) India
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3.5 py-1.5 rounded-lg font-oswald uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-black text-white shadow-sm"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                🌐 USD ($) Global
              </button>
            </div>

            {/* Billing Frequency Switcher Toggle */}
            <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-white border-2 border-slate-300 shadow-sm">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  !isAnnual ? "bg-black text-white shadow-sm" : "text-slate-600 hover:text-black"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isAnnual
                    ? "bg-emerald-500 text-black shadow-sm"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-black font-bold uppercase tracking-wider">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid in Oswald & Black Text */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {plans.map((plan, idx) => {
            const price =
              currency === "INR"
                ? isAnnual
                  ? plan.annualPriceINR
                  : plan.monthlyPriceINR
                : isAnnual
                ? plan.annualPriceUSD
                : plan.monthlyPriceUSD;

            const currencySymbol = currency === "INR" ? "₹" : "$";

            return (
              <div
                key={idx}
                className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
                  plan.highlight
                    ? "bg-white border-2 border-emerald-600 shadow-xl ring-2 ring-emerald-500/20"
                    : "bg-white border-2 border-slate-200 shadow-md"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-wider font-oswald shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-2xl font-bold text-black font-oswald uppercase">{plan.name}</h3>
                    {!plan.highlight && (
                      <span className="text-xs font-oswald uppercase font-bold text-black px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-black leading-relaxed min-h-[38px] font-medium">
                    {plan.description}
                  </p>

                  <div className="mt-6 mb-6 pb-6 border-b border-slate-200">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl sm:text-5xl font-black text-black font-oswald tracking-tight">
                        {currencySymbol}
                        {price.toLocaleString()}
                      </span>
                      <span className="text-black text-xs font-bold font-oswald uppercase">/ month</span>
                    </div>
                    <span className="text-xs text-slate-700 block mt-1 font-mono font-medium">
                      {isAnnual
                        ? `Billed annually (${currencySymbol}${(price * 12).toLocaleString()}/yr)`
                        : "Billed monthly (Cancel anytime)"}
                    </span>
                  </div>

                  <div className="space-y-3 mb-8">
                    <span className="text-xs font-oswald text-black uppercase tracking-wider font-bold block">
                      Everything included:
                    </span>
                    {plan.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs text-black font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <a
                  href={plan.ctaLink}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full py-3.5 rounded-xl text-center font-bold font-oswald text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                    plan.highlight
                      ? "bg-black hover:bg-slate-800 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-black border border-slate-300"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            );
          })}
        </div>

        {/* Indian & Global Payment Trust Badges */}
        <div className="mt-12 p-6 rounded-2xl bg-white border-2 border-slate-200 text-center space-y-3 max-w-4xl mx-auto shadow-sm">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-black uppercase font-oswald tracking-wider">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Accepted Payment Methods &amp; Invoicing</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-black text-xs font-mono font-bold border border-slate-300">
              ⚡ UPI / QR Instant
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-black text-xs font-mono font-bold border border-slate-300">
              📱 Google Pay &amp; PhonePe
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-black text-xs font-mono font-bold border border-slate-300">
              💳 Razorpay Checkout
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-black text-xs font-mono font-bold border border-slate-300">
              🏦 NetBanking (50+ Indian Banks)
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-black text-xs font-mono font-bold border border-slate-300">
              🌍 Visa / Mastercard / Amex
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-black text-xs font-mono font-bold border border-slate-300">
              📄 GST Input Tax Credit
            </span>
          </div>

          <p className="text-xs text-black font-medium max-w-xl mx-auto">
            Zero setup fees. Immediate trunk provisioning in under 24 hours. Includes dedicated Telegram engineer support.
          </p>

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="text-xs font-bold text-slate-700 font-oswald uppercase">Prefer a live strategy consultation before subscribing?</span>
            <a
              href="https://cal.com/sam-codesai/15min"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-oswald uppercase font-bold transition-all shadow-sm"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Book 15-Min Setup Call with Samarth</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
