"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, ShieldCheck, Zap, CreditCard, Building, PhoneCall, Layers } from "lucide-react";

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState<boolean>(true);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const plans = [
    {
      name: "Receptionist Starter",
      badge: "Single Location",
      monthlyPriceUSD: 49,
      annualPriceUSD: 39,
      monthlyPriceINR: 2999,
      annualPriceINR: 2499,
      description: "For clinics, salons, and local service businesses answering customer calls 24/7.",
      features: [
        "1 Dedicated Inbound Telephony Number",
        "500 Minutes Voice AI Handling / month",
        "Carrier Conditional Forwarding (*409* / *71*)",
        "Zero Phone Number Porting Required",
        "Sub-5ms SutraDB In-Memory Knowledge Grounding",
        "Automated Multi-Lingual SMS Confirmations",
        "Real-Time Appointment Booking Calendar",
        "Emergency Call Warm-Transfer to Duty Staff",
      ],
      ctaText: "Launch 60s Setup Wizard",
      ctaHref: "/receptionist/onboarding",
      highlight: false,
      icon: PhoneCall,
    },
    {
      name: "Receptionist Pro",
      badge: "Most Popular",
      monthlyPriceUSD: 149,
      annualPriceUSD: 119,
      monthlyPriceINR: 8999,
      annualPriceINR: 7199,
      description: "For busy clinics, automotive rescue dispatchers, and growing multi-chair salons.",
      features: [
        "3 Dedicated Inbound Telephony Numbers",
        "2,500 Minutes Voice AI Handling / month",
        "Sub-1,200ms Telephony Failover Watchdog",
        "Zero-Dropped-Calls Voicemail Circuit Breaker",
        "Custom SutraDB Domain Knowledge & FAQ Ingestion",
        "Full Indic Multi-Lingual Engine (Hindi, Kannada, Tamil)",
        "Tier 3 Instant Warm Emergency Call Transfer",
        "Google Calendar / Webhook Appointment Sync",
        "Direct Priority Telegram Channel Support",
      ],
      ctaText: "Deploy Pro Receptionist",
      ctaHref: "/receptionist/onboarding",
      highlight: true,
      icon: Sparkles,
    },
    {
      name: "Platform & Agency",
      badge: "Multi-Tenant Infrastructure",
      monthlyPriceUSD: 499,
      annualPriceUSD: 399,
      monthlyPriceINR: 29999,
      annualPriceINR: 23999,
      description: "For developers and voice agencies deploying custom voice agents for their downstream clients.",
      features: [
        "Multi-Tenant PBX Isolation Console",
        "Unlimited Client Tenants & Voice Agents",
        "10,000+ Minutes High-Concurrency Quota",
        "Carrier Trunk Interconnect (Twilio, Exotel, SIP)",
        "Embedded <5ms SūtraDB Hybrid Vector Memory",
        "Sub-Second Failover Watchdog (<1,200ms SLA)",
        "OpenAPI 3.1 REST API & Real-Time Webhooks",
        "Cryptographic HMAC-SHA1 Webhook Validation",
        "White-Label Reseller Client Dashboards",
      ],
      ctaText: "Open Platform Console",
      ctaHref: "/platform",
      highlight: false,
      icon: Layers,
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 border-t border-b border-white/10 bg-[#08080d] text-white relative font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header in Oswald with Glowing Badge */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-emerald-400 text-xs font-oswald uppercase tracking-wider font-bold mb-4 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>TRANSPARENT 2026 COMMERCIAL TIERS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white font-oswald uppercase tracking-tight">
            Transparent Plans. Real Infrastructure.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400 font-normal max-w-2xl mx-auto leading-relaxed">
            Whether you need a plug-and-play AI receptionist for your business or the underlying multi-tenant platform to deploy agents for clients.
          </p>

          {/* Currency and Billing Controls */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {/* Currency Selector */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs shadow-sm">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`px-3.5 py-1.5 rounded-lg font-oswald uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  currency === "INR"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                🇮🇳 INR (₹) India
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3.5 py-1.5 rounded-lg font-oswald uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                🌐 USD ($) Global
              </button>
            </div>

            {/* Billing Frequency Switcher Toggle */}
            <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 shadow-sm">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-oswald uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  !isAnnual ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-white"
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
                    : "text-gray-400 hover:text-white"
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

        {/* Pricing Cards Grid */}
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
            const PlanIcon = plan.icon;

            return (
              <div
                key={idx}
                className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
                  plan.highlight
                    ? "bg-gradient-to-b from-emerald-950/40 via-[#0a0f0d] to-black border-2 border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
                    : "bg-white/[0.02] border border-white/10 hover:border-white/20 shadow-xl"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-xs font-black uppercase tracking-wider font-oswald shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400">
                        <PlanIcon className="w-4 h-4" />
                      </div>
                      <h3 className="text-xl font-bold text-white font-oswald uppercase tracking-wide">
                        {plan.name}
                      </h3>
                    </div>
                    {!plan.highlight && (
                      <span className="text-[10px] font-mono uppercase font-bold text-gray-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-400 leading-relaxed min-h-[38px]">
                    {plan.description}
                  </p>

                  <div className="mt-6 mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl sm:text-5xl font-black text-white font-oswald tracking-tight">
                        {currencySymbol}
                        {price.toLocaleString()}
                      </span>
                      <span className="text-gray-400 text-xs font-bold font-oswald uppercase">/ month</span>
                    </div>
                    <span className="text-xs text-gray-500 block mt-1 font-mono">
                      {isAnnual
                        ? `Billed annually (${currencySymbol}${(price * 12).toLocaleString()}/yr)`
                        : "Billed monthly (Cancel anytime)"}
                    </span>
                  </div>

                  <div className="space-y-3 mb-8">
                    <span className="text-xs font-oswald text-gray-300 uppercase tracking-wider font-bold block">
                      Everything included:
                    </span>
                    {plan.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs text-gray-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={plan.ctaHref}
                  className={`w-full py-3.5 rounded-xl text-center font-bold font-oswald text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    plan.highlight
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                      : "bg-white text-black hover:bg-gray-200"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Indian & Global Payment Trust Badges */}
        <div className="mt-12 p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-3 max-w-4xl mx-auto shadow-sm">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-300 uppercase font-oswald tracking-wider">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Enterprise Telephony &amp; Telecom Compliance</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs font-mono text-gray-400">
            <span className="px-3 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10">
              ⚡ Instant UPI / QR Payment
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10">
              💳 Credit / Debit Cards
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10">
              🧾 18% GST Compliant Invoicing
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10">
              📞 Zero Phone Number Porting
            </span>
          </div>

          <p className="text-xs text-gray-500 pt-1">
            Need custom high-concurrency SIP trunks or on-premise deployment? Contact us on Telegram:{" "}
            <a
              href="https://t.me/Samarth1306"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline font-mono"
            >
              @Samarth1306
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
