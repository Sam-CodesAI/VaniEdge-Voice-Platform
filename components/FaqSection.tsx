"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: "What makes VaniEdge fundamentally different from standard cloud voice bots?",
      answer:
        "Standard cloud voice bots bounce your customer's audio through multiple centralized US data centers, adding 2.5 to 5+ seconds of latency and frequently dropping calls when an LLM or speech API rate-limits. VaniEdge runs on distributed edge workers, streams raw audio directly via WebSocket carrier interconnects, and operates an atomic sub-1,200ms failover watchdog that guarantees 100% call continuity with zero dropped calls.",
    },
    {
      question: "How does the Zero-Dropped-Call Failover Watchdog work in real time?",
      answer:
        "Every incoming call is supervised by a 100ms interval watchdog timer. If an upstream language model or speech generation endpoint fails to produce audio within 1,200ms of the caller stopping speaking (or 1,500ms conversational TTFT), VaniEdge instantly flushes the buffer and executes an atomic Twilio REST redirect (<20ms) to your human backup line or specialist with polite holding audio. The caller never hears silence or a dead tone.",
    },
    {
      question: "Which languages and regional Indian accents are natively supported?",
      answer:
        "VaniEdge natively supports English, Hindi (हिंदी), Kannada (ಕನ್ನಡ), Marathi (मराठी), Tamil (தமிழ்), and Spanish (Español). The engine automatically parses mixed colloquial queries (e.g. Hinglish or Kannada-English), understands localized phonetic names, and synthesizes natural regional voice responses tailored to your local geography.",
    },
    {
      question: "Can we keep our existing business phone number without porting?",
      answer:
        "Yes! You keep your existing mobile number and SIM card. Using native telecom conditional forwarding (*409* for Jio, *71* for Airtel, *67* for Vi/BSNL), your carrier redirects callers to your AI Receptionist only when you're busy or on another call. No carrier porting, no hardware changes, and no paperwork required.",
    },
    {
      question: "What is SutraDB and why does it eliminate vector cloud bills?",
      answer:
        "SutraDB is our custom ultra-lightweight hybrid vector engine built specifically for edge runtimes. It executes Reciprocal Rank Fusion combining 60% Dense Semantic Vector embeddings with 40% BM25 Lexical text matching in under 5ms with zero external cloud dependencies. This eliminates $70+/month SaaS bills for Pinecone or Weaviate while delivering faster responses.",
    },
    {
      question: "How long does it take to deploy VaniEdge Receptionist?",
      answer:
        "You can be fully live in under 60 seconds with our setup wizard. Simply enter your business name, verify your services and hours, choose your voice persona, and dial your carrier's forwarding code. The AI immediately starts answering your incoming business calls.",
    },
  ];

  return (
    <section id="faq" className="py-20 sm:py-28 border-t border-b border-white/10 bg-[#07070a] text-white relative font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-emerald-400 text-xs font-oswald uppercase tracking-wider font-bold mb-4">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white font-oswald uppercase tracking-tight">
            Everything You Need to Know
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400 font-normal leading-relaxed">
            Got questions about carrier forwarding, edge failover, or language models? We've got answers.
          </p>
        </div>

        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 overflow-hidden transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-white font-oswald uppercase tracking-wide hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-emerald-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-gray-300 leading-relaxed border-t border-white/5 pt-3.5 font-normal">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
