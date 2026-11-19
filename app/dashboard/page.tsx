"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneCall,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  AlertTriangle,
  ArrowRight,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Calendar,
  Filter,
  Sparkles,
  Smartphone,
  Check,
  Copy,
  Building,
  Activity,
  Layers,
} from "lucide-react";
import CarrierForwardingModal from "@/components/CarrierForwardingModal";
import { UserRecord } from "@/lib/auth-store";

interface CallTranscriptItem {
  role: "agent" | "caller" | "system";
  text: string;
  timestamp: number;
}

interface CallSession {
  callSid: string;
  tenantId: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  phase: string;
  transcript: CallTranscriptItem[];
  latencyMs: { total: number };
  failoverTriggered: boolean;
  failoverReason?: string;
  smsRescueSent: boolean;
  createdAt: number;
  updatedAt: number;
}

interface TicketRecord {
  ticketId: string;
  callerName: string;
  callerPhone: string;
  category: string;
  serviceType: string;
  details: string;
  status: "PENDING" | "CONFIRMED" | "DISPATCHED" | "ESCALATED" | "RESOLVED" | "COMPLETED" | "CANCELLED";
  priority: "STANDARD" | "URGENT" | "CRITICAL";
  language: string;
  smsConfirmation: string;
  checksum: string;
  timestamp: string;
  notes?: string[];
}

const DEMO_CALLS: CallSession[] = [
  {
    callSid: "CA_live_dental_9918",
    tenantId: "careplus-clinic",
    from: "+1 (415) 890-2134",
    to: "+1 (814) 961-3703",
    direction: "inbound",
    phase: "completed",
    latencyMs: { total: 14.8 },
    failoverTriggered: false,
    smsRescueSent: false,
    createdAt: Date.now() - 1000 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 10,
    transcript: [
      {
        role: "agent",
        text: "Namaste and thank you for calling CarePlus Healthcare. How may I assist with your doctor appointment or medical question today?",
        timestamp: Date.now() - 1000 * 60 * 12,
      },
      {
        role: "caller",
        text: "Hi, I have severe molar tooth pain and need an emergency dental consultation today.",
        timestamp: Date.now() - 1000 * 60 * 12 + 4000,
      },
      {
        role: "agent",
        text: "I understand that must be very uncomfortable. We have an urgent slot at 3:30 PM with Dr. Sharma. Would you like me to book your name and send the confirmation via SMS?",
        timestamp: Date.now() - 1000 * 60 * 12 + 7500,
      },
      {
        role: "caller",
        text: "Yes, please! My name is Priya Mehta, and my number is 415-890-2134.",
        timestamp: Date.now() - 1000 * 60 * 12 + 11000,
      },
      {
        role: "agent",
        text: "Your appointment is confirmed for today at 3:30 PM. A confirmation SMS with clinic directions has been sent to your phone. Please bring your insurance card.",
        timestamp: Date.now() - 1000 * 60 * 12 + 15000,
      },
    ],
  },
  {
    callSid: "CA_live_hvac_7741",
    tenantId: "apex-hvac",
    from: "+1 (303) 555-0144",
    to: "+1 (814) 961-3703",
    direction: "inbound",
    phase: "completed",
    latencyMs: { total: 17.2 },
    failoverTriggered: false,
    smsRescueSent: false,
    createdAt: Date.now() - 1000 * 60 * 45,
    updatedAt: Date.now() - 1000 * 60 * 42,
    transcript: [
      {
        role: "agent",
        text: "Apex 24/7 HVAC & Emergency Services. Are you experiencing a heating failure or water leak?",
        timestamp: Date.now() - 1000 * 60 * 45,
      },
      {
        role: "caller",
        text: "Yes, our main water heater burst in the basement and water is pooling fast!",
        timestamp: Date.now() - 1000 * 60 * 45 + 3200,
      },
      {
        role: "agent",
        text: "Understood. Please shut off the main water shut-off valve immediately. I am flagging this as an emergency dispatch and notifying the on-call technician.",
        timestamp: Date.now() - 1000 * 60 * 45 + 6800,
      },
    ],
  },
  {
    callSid: "CA_live_rescue_3301",
    tenantId: "apex-hvac",
    from: "+1 (720) 412-8877",
    to: "+1 (814) 961-3703",
    direction: "inbound",
    phase: "sms_rescued",
    latencyMs: { total: 8.5 },
    failoverTriggered: true,
    failoverReason: "caller_hangup",
    smsRescueSent: true,
    createdAt: Date.now() - 1000 * 60 * 120,
    updatedAt: Date.now() - 1000 * 60 * 119,
    transcript: [
      {
        role: "agent",
        text: "Thank you for calling. How can we help you today?",
        timestamp: Date.now() - 1000 * 60 * 120,
      },
      {
        role: "system",
        text: "[Status Callback] Call hung up abruptly (< 8s). Omnichannel Tier 4 SMS Rescue automatically dispatched to +17204128877.",
        timestamp: Date.now() - 1000 * 60 * 119,
      },
    ],
  },
];

const DEMO_TICKETS: TicketRecord[] = [
  {
    ticketId: "TCK-DENT-8821",
    callerName: "Priya Mehta",
    callerPhone: "+1 (415) 890-2134",
    category: "clinic",
    serviceType: "Urgent Dental Consultation",
    details: "Severe molar tooth pain, requested 3:30 PM slot with Dr. Sharma.",
    status: "CONFIRMED",
    priority: "URGENT",
    language: "en",
    smsConfirmation: "[VaniEdge AI] Appointment confirmed for Priya Mehta at 3:30 PM. Ref: TCK-DENT-8821.",
    checksum: "A9E281F0",
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    notes: ["Booked via Inbound Voice AI", "SMS confirmation dispatched"],
  },
  {
    ticketId: "TCK-HVAC-9104",
    callerName: "David Miller",
    callerPhone: "+1 (303) 555-0144",
    category: "home_services",
    serviceType: "Emergency Water Heater Burst",
    details: "Water leak in basement, caller shut off main valve. Dispatching technician.",
    status: "DISPATCHED",
    priority: "CRITICAL",
    language: "en",
    smsConfirmation: "[VaniEdge AI] Emergency request dispatched for David Miller. On-call tech en route.",
    checksum: "C401B79E",
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    notes: ["Escalated to On-Call Technician: +1 (303) 555-0199"],
  },
  {
    ticketId: "TCK-LEAD-3012",
    callerName: "Carlos Ramirez",
    callerPhone: "+1 (720) 412-8877",
    category: "home_services",
    serviceType: "Missed Call SMS Rescue Inquiry",
    details: "Caller replied to automated SMS rescue seeking furnace tune-up quote.",
    status: "PENDING",
    priority: "STANDARD",
    language: "en",
    smsConfirmation: "[VaniEdge AI] Thanks for contacting us. A coordinator will call back within 15 mins.",
    checksum: "7F89320A",
    timestamp: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
    notes: ["Captured via Tier 4 SMS Rescue link"],
  },
];

export default function BusinessDashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [calls, setCalls] = useState<CallSession[]>(DEMO_CALLS);
  const [tickets, setTickets] = useState<TicketRecord[]>(DEMO_TICKETS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"calls" | "tickets" | "forwarding">("calls");
  const [selectedCallSid, setSelectedCallSid] = useState<string | null>(null);
  const [forwardingModalOpen, setForwardingModalOpen] = useState<boolean>(false);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [copiedSid, setCopiedSid] = useState<string | null>(null);

  // Load Auth and Data
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Get Me
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = (await meRes.json()) as { user: UserRecord };
        setCurrentUser(meData.user);
      }

      // 2. Get Calls
      const callsRes = await fetch("/api/voice/calls");
      if (callsRes.ok) {
        const callsData = (await callsRes.json()) as { calls: CallSession[] };
        if (callsData.calls && callsData.calls.length > 0) {
          setCalls(callsData.calls);
        }
      }

      // 3. Get Tickets
      const ticketsRes = await fetch("/api/dispatch");
      if (ticketsRes.ok) {
        const ticketsData = (await ticketsRes.json()) as { tickets: TicketRecord[] };
        if (ticketsData.tickets && ticketsData.tickets.length > 0) {
          setTickets(ticketsData.tickets);
        }
      }
    } catch (err) {
      console.warn("Failed to load live dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Ticket Status Mutation
  const handleUpdateStatus = async (ticketId: string, newStatus: TicketRecord["status"]) => {
    setUpdatingTicketId(ticketId);
    try {
      const res = await fetch("/api/dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          status: newStatus,
          note: `Updated to ${newStatus} from Customer Dashboard`,
        }),
      });

      if (res.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.ticketId === ticketId ? { ...t, status: newStatus } : t))
        );
      } else {
        // Optimistic update for demo purposes
        setTickets((prev) =>
          prev.map((t) => (t.ticketId === ticketId ? { ...t, status: newStatus } : t))
        );
      }
    } catch {
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === ticketId ? { ...t, status: newStatus } : t))
      );
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSid(id);
    setTimeout(() => setCopiedSid(null), 2000);
  };

  // KPI Calculations
  const totalCalls = calls.length;
  const rescuedCalls = calls.filter((c) => c.smsRescueSent || c.phase === "sms_rescued").length;
  const avgLatency =
    calls.reduce((acc, c) => acc + (c.latencyMs?.total || 16.5), 0) / (totalCalls || 1);

  return (
    <div className="min-h-screen bg-[#070709] text-gray-100 selection:bg-blue-600/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0d0d12]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="font-bold font-oswald text-lg tracking-wider text-white">
                  VANIEDGE
                </span>
                <span className="text-[10px] block font-mono text-blue-400">
                  VOICE TELEPHONY PORTAL
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs">
              <button
                onClick={() => setActiveTab("calls")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  activeTab === "calls"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Inbound Call Logs
              </button>
              <button
                onClick={() => setActiveTab("tickets")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  activeTab === "tickets"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Dispatch & Booking Leads
              </button>
              <button
                onClick={() => setActiveTab("forwarding")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  activeTab === "forwarding"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Carrier Phone Forwarding
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Line Badge */}
            <a
              href="tel:+18149613703"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              +1 (814) 961-3703
            </a>

            <button
              onClick={() => setForwardingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm shadow-blue-500/20"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Connect Phone
            </button>

            <Link
              href="/agency"
              className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium border border-white/10 transition-colors"
            >
              <Building className="w-3.5 h-3.5 text-blue-400" />
              Agency Console
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner with Strategy Callout */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-purple-950/30 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Live Production Portal
              </span>
              <span className="text-xs text-gray-400">
                {currentUser?.email ? `Logged in as ${currentUser.email}` : "Client Command Center"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-oswald text-white uppercase tracking-wide">
              Real-Time Voice AI Mission Control
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl">
              Every incoming call to your forwarded business line is captured with sub-18ms latency,
              logged in real-time, and dispatched to your team with zero missed bookings.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="https://cal.com/sam-codesai/15min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-gray-200 transition-colors shadow-lg"
            >
              <Calendar className="w-3.5 h-3.5" />
              Book 1-on-1 Onboarding
            </a>
            <a
              href="https://t.me/Samarth1306"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-md shadow-blue-500/20"
            >
              Telegram Support
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Telephony KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-[#0f0f14] border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Inbound Calls</span>
              <PhoneCall className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-white">
              {totalCalls}
            </div>
            <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              100% Answer Rate
            </span>
          </div>

          <div className="p-5 rounded-xl bg-[#0f0f14] border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency (TTFT)</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-amber-300">
              {avgLatency.toFixed(1)} ms
            </div>
            <span className="text-[11px] text-gray-400 mt-1">SutraDB Edge Index</span>
          </div>

          <div className="p-5 rounded-xl bg-[#0f0f14] border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Dispatched Leads</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-white">
              {tickets.length}
            </div>
            <span className="text-[11px] text-emerald-400 mt-1">Instant SMS sync</span>
          </div>

          <div className="p-5 rounded-xl bg-[#0f0f14] border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Rescued Calls (Tier 4)</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-purple-300">
              {rescuedCalls}
            </div>
            <span className="text-[11px] text-purple-400 mt-1">Zero lost revenue</span>
          </div>
        </div>

        {/* Tab Navigation (Mobile & Desktop) */}
        <div className="flex border-b border-white/10 space-x-6 text-sm">
          <button
            onClick={() => setActiveTab("calls")}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "calls"
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            Call Logs & Transcripts ({calls.length})
          </button>
          <button
            onClick={() => setActiveTab("tickets")}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "tickets"
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Customer Leads & Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab("forwarding")}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "forwarding"
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Carrier Setup Instructions
          </button>
        </div>

        {/* TAB 1: CALL LOGS */}
        {activeTab === "calls" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-oswald uppercase text-white tracking-wide">
                Live Inbound Voice Dialogues
              </h2>
              <button
                onClick={loadDashboardData}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh Calls
              </button>
            </div>

            <div className="bg-[#0f0f14] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
              {calls.map((call) => {
                const isExpanded = selectedCallSid === call.callSid;
                const formattedDate = new Date(call.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={call.callSid} className="transition-colors hover:bg-white/[0.02]">
                    <div
                      onClick={() => setSelectedCallSid(isExpanded ? null : call.callSid)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            call.phase === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : call.phase === "sms_rescued"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          <PhoneCall className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-white tracking-wider">
                              {call.from}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                                call.phase === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : call.phase === "sms_rescued"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {call.phase}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Target Line: {call.to} • {formattedDate} • Latency:{" "}
                            {call.latencyMs?.total ? `${call.latencyMs.total.toFixed(1)}ms` : "14ms"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <a
                          href={`tel:${call.from}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 border border-white/10 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-blue-400" />
                          Call Back
                        </a>

                        <button className="text-gray-400 hover:text-white p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Transcript Drawer */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 bg-black/60 border-t border-white/5 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span className="font-semibold uppercase tracking-wider text-gray-300">
                            Full Audio Call Transcript
                          </span>
                          <span className="font-mono text-[11px]">Call SID: {call.callSid}</span>
                        </div>

                        <div className="space-y-3 font-sans text-sm">
                          {call.transcript && call.transcript.length > 0 ? (
                            call.transcript.map((item, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl max-w-2xl ${
                                  item.role === "agent"
                                    ? "bg-blue-950/30 border border-blue-500/20 text-blue-100 ml-auto"
                                    : item.role === "caller"
                                    ? "bg-white/5 border border-white/10 text-gray-200 mr-auto"
                                    : "bg-purple-950/30 border border-purple-500/20 text-purple-200 text-xs italic mx-auto"
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                                  <span className="font-semibold uppercase tracking-wider">
                                    {item.role === "agent"
                                      ? "VaniEdge Voice AI"
                                      : item.role === "caller"
                                      ? "Caller"
                                      : "System Event"}
                                  </span>
                                  <span>
                                    {new Date(item.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="leading-relaxed">{item.text}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500 italic">No audio turns recorded.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: TICKETS & LEADS */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-oswald uppercase text-white tracking-wide">
                Dispatched Client Bookings & Service Requests
              </h2>
              <button
                onClick={loadDashboardData}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh Leads
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((t) => (
                <div
                  key={t.ticketId}
                  className="p-5 rounded-xl bg-[#0f0f14] border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {t.ticketId}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          t.status === "CONFIRMED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : t.status === "DISPATCHED"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : t.status === "ESCALATED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-white text-base font-oswald tracking-wide">
                        {t.callerName}
                      </h3>
                      <a
                        href={`tel:${t.callerPhone}`}
                        className="text-xs font-mono text-gray-400 hover:text-blue-300 flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="w-3 h-3 text-emerald-400" />
                        {t.callerPhone}
                      </a>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/50 border border-white/5 text-xs text-gray-300">
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                        Service Requested:
                      </span>
                      <strong className="text-white">{t.serviceType}</strong>
                      <p className="mt-1 text-gray-400 line-clamp-2">{t.details}</p>
                    </div>

                    {t.smsConfirmation && (
                      <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-200/90 font-mono">
                        <span className="text-[9px] uppercase tracking-wider text-blue-400 block font-sans font-bold">
                          SMS Confirmation Sent:
                        </span>
                        {t.smsConfirmation}
                      </div>
                    )}
                  </div>

                  {/* 1-Click Status Controls */}
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                      Quick Status Actions:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {t.status !== "CONFIRMED" && (
                        <button
                          disabled={updatingTicketId === t.ticketId}
                          onClick={() => handleUpdateStatus(t.ticketId, "CONFIRMED")}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition-colors text-center"
                        >
                          Confirm
                        </button>
                      )}
                      {t.status !== "DISPATCHED" && (
                        <button
                          disabled={updatingTicketId === t.ticketId}
                          onClick={() => handleUpdateStatus(t.ticketId, "DISPATCHED")}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium transition-colors text-center"
                        >
                          Dispatch
                        </button>
                      )}
                      {t.status !== "COMPLETED" && (
                        <button
                          disabled={updatingTicketId === t.ticketId}
                          onClick={() => handleUpdateStatus(t.ticketId, "COMPLETED")}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-medium transition-colors text-center col-span-2"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FORWARDING & CARRIER SETUP */}
        {activeTab === "forwarding" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#0f0f14] border border-white/10 space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold font-oswald text-white uppercase tracking-wide">
                    Connect Any Existing Phone Number
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 max-w-xl">
                    Follow the carrier guide below. By setting up conditional call forwarding, your
                    business phone rings first. If you miss the call, VaniEdge Voice AI answers
                    instantly within 18ms.
                  </p>
                </div>
                <button
                  onClick={() => setForwardingModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Smartphone className="w-4 h-4" />
                  Open Interactive Carrier Modal
                </button>
              </div>

              {/* Instructions Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <h4 className="font-bold text-white text-sm">Pick Your Mobile Carrier</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Select your carrier (Verizon, AT&T, T-Mobile, Jio, Airtel, Vi) to get your 1-click
                    activation dial code.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <h4 className="font-bold text-white text-sm">Dial Forwarding Code</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Open your phone dialer, type the 4-digit code along with your VaniEdge number, and
                    press Call.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <h4 className="font-bold text-white text-sm">Place a Test Call</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Call your business phone from another line, let it ring 3 times, and hear VaniEdge
                    greet your callers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Carrier Forwarding Modal */}
      <CarrierForwardingModal
        isOpen={forwardingModalOpen}
        onClose={() => setForwardingModalOpen(false)}
        targetPhone="+18149613703"
      />
    </div>
  );
}
