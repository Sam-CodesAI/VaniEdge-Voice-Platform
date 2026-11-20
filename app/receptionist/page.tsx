"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneCall,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Zap,
  Play,
  RotateCcw,
  Sliders,
  Send,
  Plus,
  Search,
  Filter,
  Check,
  Building,
  Activity,
  Layers,
  ArrowRight,
} from "lucide-react";
import CarrierPhone3DSimulator from "@/components/CarrierPhone3DSimulator";
import CarrierForwardingModal from "@/components/CarrierForwardingModal";
import LandingFooter from "@/components/LandingFooter";
import { Appointment } from "@/lib/appointments-store";

interface ReceptionistCall {
  id: string;
  callerName: string;
  callerPhone: string;
  durationSec: number;
  timestamp: string;
  intent: "appointment" | "inquiry" | "emergency" | "voicemail";
  status: "completed" | "transferred" | "voicemail";
  transcriptSummary: string;
  fullTranscript: { speaker: "agent" | "caller"; text: string }[];
}

const DEMO_CALLS: ReceptionistCall[] = [
  {
    id: "call_01",
    callerName: "Vikram Patil",
    callerPhone: "+91 98765 43210",
    durationSec: 79,
    timestamp: "10 mins ago",
    intent: "appointment",
    status: "completed",
    transcriptSummary: "Booked general physician consultation for today at 4:30 PM. Confirmed via SMS.",
    fullTranscript: [
      { speaker: "agent", text: "Namaste! Welcome to CarePlus Healthcare & Clinics. I am Sarah, your AI receptionist. How may I assist your call today?" },
      { speaker: "caller", text: "Hello Sarah, I want to book an appointment with Dr. Sharma for a viral fever checkup today." },
      { speaker: "agent", text: "I would be happy to help with that. Dr. Sharma has open slots today at 4:30 PM or 6:00 PM. Which time suits you best?" },
      { speaker: "caller", text: "4:30 PM works great." },
      { speaker: "agent", text: "Perfect! I have confirmed your appointment for 4:30 PM today with Dr. Sharma. A confirmation SMS has been dispatched to this number. Is there anything else?" },
      { speaker: "caller", text: "No, thank you Sarah!" },
    ],
  },
  {
    id: "call_02",
    callerName: "Ananya Sharma",
    callerPhone: "+91 99887 76655",
    durationSec: 45,
    timestamp: "35 mins ago",
    intent: "inquiry",
    status: "completed",
    transcriptSummary: "Inquired about pediatric vaccination schedules and clinic consultation charges (₹500).",
    fullTranscript: [
      { speaker: "agent", text: "Welcome to CarePlus Clinics. How may I direct your inquiry?" },
      { speaker: "caller", text: "What is the consultation fee for the child vaccination clinic?" },
      { speaker: "agent", text: "Our pediatric wellness and vaccination consultation fee is ₹500. Vaccinations are administered Monday through Saturday between 9:00 AM and 7:00 PM." },
      { speaker: "caller", text: "Okay, thank you!" },
    ],
  },
  {
    id: "call_03",
    callerName: "Rajesh Kumar",
    callerPhone: "+91 98111 22334",
    durationSec: 92,
    timestamp: "1 hour ago",
    intent: "emergency",
    status: "transferred",
    transcriptSummary: "Emergency triage: severe chest pain reported. Tier 3 warm call transfer executed to on-call duty ER doctor.",
    fullTranscript: [
      { speaker: "agent", text: "Welcome to CarePlus Clinics. How may I assist you?" },
      { speaker: "caller", text: "My father is experiencing sudden severe chest pain and dizziness!" },
      { speaker: "agent", text: "I understand this is critical. I am immediately connecting you to our emergency duty doctor on this line right now. Please remain on the line." },
    ],
  },
];

export default function ReceptionistPage() {
  const [activeTab, setActiveTab] = useState<"calls" | "appointments" | "settings" | "forwarding">("calls");
  const [calls] = useState<ReceptionistCall[]>(DEMO_CALLS);
  const [selectedCall, setSelectedCall] = useState<ReceptionistCall>(DEMO_CALLS[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [forwardingModalOpen, setForwardingModalOpen] = useState(false);

  // Receptionist Settings State
  const [businessName, setBusinessName] = useState("CarePlus Healthcare & Clinics");
  const [greetingText, setGreetingText] = useState(
    "Namaste! Welcome to CarePlus Healthcare & Clinics. I am Sarah, your AI voice receptionist. How may I assist your doctor appointment or medical inquiry today?"
  );
  const [selectedVoice, setSelectedVoice] = useState("sarah");
  const [afterHoursVoicemail, setAfterHoursVoicemail] = useState(true);
  const [emergencyForwardPhone, setEmergencyForwardPhone] = useState("+91 63612 09256");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // New Appointment Form State
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newServiceType, setNewServiceType] = useState("General Physician Consultation");

  useEffect(() => {
    fetch("/api/receptionist/appointments")
      .then(async (r) => {
        if (r.ok) {
          const res = (await r.json()) as { appointments?: Appointment[] };
          if (res.appointments) setAppointments(res.appointments);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateStatus = async (id: string, status: Appointment["status"]) => {
    try {
      const res = await fetch("/api/receptionist/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a))
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !newPatientPhone.trim()) return;

    try {
      const res = await fetch("/api/receptionist/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "clinic",
          callerName: newPatientName.trim(),
          callerPhone: newPatientPhone.trim(),
          serviceType: newServiceType,
          scheduledTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          source: "manual",
        }),
      });
      const data = (await res.json()) as { success?: boolean; appointment?: Appointment };
      if (data.appointment) {
        setAppointments((prev) => [data.appointment!, ...prev]);
        setNewPatientName("");
        setNewPatientPhone("");
        setShowAddAppt(false);
      }
    } catch {
      // Ignore
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const filteredAppointments = appointments.filter((a) => {
    if (filterStatus === "all") return true;
    return a.status.toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-[#07070a] text-white selection:bg-emerald-500/30 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#0d0d12]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-black font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <PhoneCall className="w-5 h-5 text-black" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-oswald text-lg tracking-wider text-white uppercase">
                    VANIEDGE
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                    RECEPTIONIST
                  </span>
                </div>
                <span className="text-[11px] font-mono text-gray-400">
                  Business Voice Receptionist Application
                </span>
              </div>
            </Link>
          </div>

          {/* Right Navigation & Switchers */}
          <div className="flex items-center gap-3">
            <Link
              href="/receptionist/onboarding"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-oswald uppercase text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>60s Setup Wizard</span>
            </Link>

            <Link
              href="/platform"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-oswald uppercase text-xs font-bold transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Switch to</span>
              <span>Platform</span>
            </Link>

            <button
              type="button"
              onClick={() => setForwardingModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:text-white hover:bg-blue-600/30 font-oswald uppercase text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Carrier</span>
              <span>Forwarding</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Receptionist Status & Quick Telephony Bar */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-[#0d0d14] to-black border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-oswald uppercase tracking-wide text-white">
                  {businessName}
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  RECEPTIONIST LIVE
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Connected DID: <span className="font-mono text-emerald-400 font-bold">+1 (814) 961-3703</span> • Answering on 1st Ring • Zero Dropped Calls SLA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("forwarding")}
              className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-oswald uppercase font-bold text-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Forwarding Codes</span>
            </button>
            <Link
              href="/#carrier-chaos-lab"
              className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-oswald uppercase font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-black" />
              <span>Test AI Voice Call</span>
            </Link>
          </div>
        </div>

        {/* 4 Performance Metric Badges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0c0d12] border border-white/10 space-y-1">
            <span className="text-xs font-mono text-gray-400">Total Calls Handled</span>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-white">28</div>
            <span className="text-[10px] text-emerald-400 font-mono">100% Answer Rate on 1st Ring</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0c0d12] border border-white/10 space-y-1">
            <span className="text-xs font-mono text-gray-400">Appointments Booked</span>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-emerald-400">
              {appointments.length}
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Synced with Schedule</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0c0d12] border border-white/10 space-y-1">
            <span className="text-xs font-mono text-gray-400">Emergency Triage Handoffs</span>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-amber-400">1</div>
            <span className="text-[10px] text-amber-400/90 font-mono">Warm Doctor Transfer in 0.8s</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0c0d12] border border-white/10 space-y-1">
            <span className="text-xs font-mono text-gray-400">Voice Latency (TTFT)</span>
            <div className="text-2xl sm:text-3xl font-bold font-oswald text-cyan-400">385ms</div>
            <span className="text-[10px] text-cyan-400/90 font-mono">Sub-Second Conversational</span>
          </div>
        </div>

        {/* Operational Tabs Selector */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("calls")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-oswald uppercase font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "calls"
                ? "bg-white text-black shadow-md shadow-white/10"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Call Inbox &amp; Transcripts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-oswald uppercase font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "appointments"
                ? "bg-white text-black shadow-md shadow-white/10"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Booked Appointments ({appointments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-oswald uppercase font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-white text-black shadow-md shadow-white/10"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Receptionist Settings &amp; Voice</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("forwarding")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-oswald uppercase font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "forwarding"
                ? "bg-white text-black shadow-md shadow-white/10"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Carrier Forwarding Setup</span>
          </button>
        </div>

        {/* TAB 1: CALL INBOX & TRANSCRIPTS */}
        {activeTab === "calls" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Call List Feed */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-mono uppercase text-gray-400 font-bold">
                  Recent Inbound Business Calls
                </span>
                <span className="text-xs font-mono text-emerald-400">Live Feed</span>
              </div>

              {calls.map((call) => {
                const isSelected = selectedCall.id === call.id;
                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#14141c] border-emerald-500/60 shadow-lg shadow-emerald-500/10"
                        : "bg-[#0c0d12] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-white font-oswald uppercase">
                        {call.callerName}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">{call.timestamp}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
                      <span>{call.callerPhone}</span>
                      <span>{call.durationSec}s</span>
                    </div>

                    <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                      {call.transcriptSummary}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          call.intent === "appointment"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : call.intent === "emergency"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {call.intent}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        Status: {call.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Active Call Transcript Inspector */}
            <div className="lg:col-span-7 bg-[#0c0d12] border border-white/10 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold font-oswald uppercase text-white">
                    {selectedCall.callerName}
                  </h3>
                  <div className="text-xs font-mono text-gray-400 mt-0.5">
                    {selectedCall.callerPhone} • Duration: {selectedCall.durationSec}s • {selectedCall.timestamp}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-full font-bold uppercase ${
                      selectedCall.intent === "appointment"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : selectedCall.intent === "emergency"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    }`}
                  >
                    {selectedCall.intent}
                  </span>
                </div>
              </div>

              {/* Action Summary Box */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5">
                <span className="text-xs font-mono text-emerald-400 font-bold uppercase">
                  AI Receptionist Action Taken:
                </span>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {selectedCall.transcriptSummary}
                </p>
              </div>

              {/* Full Interactive Dialogue Stream */}
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {selectedCall.fullTranscript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${
                      msg.speaker === "agent" ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-oswald shrink-0 ${
                        msg.speaker === "agent"
                          ? "bg-emerald-600 text-black"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {msg.speaker === "agent" ? "AI" : "YOU"}
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[80%] ${
                        msg.speaker === "agent"
                          ? "bg-[#161720] border border-white/10 text-gray-200"
                          : "bg-blue-600/20 border border-blue-500/30 text-white"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKED APPOINTMENTS */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 uppercase font-bold">Filter:</span>
                {["all", "confirmed", "pending", "completed", "cancelled"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono uppercase font-bold transition-all cursor-pointer ${
                      filterStatus === st
                        ? "bg-white text-black"
                        : "bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAddAppt(!showAddAppt)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-oswald uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Book Manual Appointment</span>
              </button>
            </div>

            {/* Manual Appointment Creation Drawer */}
            {showAddAppt && (
              <form
                onSubmit={handleCreateAppointment}
                className="p-5 rounded-2xl bg-[#0c0d12] border border-emerald-500/40 space-y-4 animate-in fade-in"
              >
                <h4 className="text-sm font-bold font-oswald uppercase text-white">
                  Add New Customer Appointment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Patient / Customer Name"
                    className="px-3.5 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    type="tel"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    placeholder="Phone (e.g. +91 98765 43210)"
                    className="px-3.5 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <select
                    value={newServiceType}
                    onChange={(e) => setNewServiceType(e.target.value)}
                    className="px-3.5 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="General Physician Consultation">General Physician Consultation</option>
                    <option value="Pediatric Wellness Checkup">Pediatric Wellness Checkup</option>
                    <option value="Dental Routine Cleaning">Dental Routine Cleaning</option>
                    <option value="Specialist Follow-Up Visit">Specialist Follow-Up Visit</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAppt(false)}
                    className="px-4 py-1.5 rounded-lg text-xs font-mono text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-oswald uppercase"
                  >
                    Save &amp; Confirm Slot
                  </button>
                </div>
              </form>
            )}

            {/* Appointments Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0c0d12]">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-gray-400 font-oswald uppercase">
                  <tr>
                    <th className="p-3.5">Customer Name</th>
                    <th className="p-3.5">Phone Number</th>
                    <th className="p-3.5">Requested Service</th>
                    <th className="p-3.5">Scheduled Slot</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-bold font-oswald uppercase text-white text-sm">
                        {appt.callerName}
                      </td>
                      <td className="p-3.5 text-gray-300">{appt.callerPhone}</td>
                      <td className="p-3.5 text-gray-200">{appt.serviceType}</td>
                      <td className="p-3.5 text-emerald-400 font-bold">
                        {new Date(appt.scheduledTime).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        at{" "}
                        {new Date(appt.scheduledTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            appt.status === "CONFIRMED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : appt.status === "COMPLETED"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              : appt.status === "CANCELLED"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {appt.status !== "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(appt.id, "COMPLETED")}
                              className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-[10px] uppercase font-oswald transition-colors"
                            >
                              Complete
                            </button>
                          )}
                          {appt.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(appt.id, "CANCELLED")}
                              className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-[10px] uppercase font-oswald transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: RECEPTIONIST SETTINGS & VOICE */}
        {activeTab === "settings" && (
          <form
            onSubmit={handleSaveSettings}
            className="max-w-4xl mx-auto bg-[#0c0d12] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div className="pb-4 border-b border-white/10">
              <h3 className="text-xl font-bold font-oswald uppercase text-white">
                AI Voice Receptionist Configuration
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Configure your business greeting, voice tone, office hours, and emergency escalation rules.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5 font-bold">
                  Business / Practice Name:
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-oswald text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5 font-bold">
                  Receptionist Spoken Greeting:
                </label>
                <textarea
                  rows={3}
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[10px] text-gray-500 font-mono">
                  This greeting is spoken on the 1st ring when a customer calls your number.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5 font-bold">
                    Receptionist Persona &amp; Voice:
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                  >
                    <option value="sarah">Sarah — Caring Clinic &amp; Medical Receptionist</option>
                    <option value="joanna">Joanna — Executive Legal &amp; Corporate Voice</option>
                    <option value="bella">Bella — Warm Restaurant &amp; Dining Host</option>
                    <option value="adam">Adam — Technical Dispatch &amp; Roadside Auto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5 font-bold">
                    Emergency Staff Transfer Number:
                  </label>
                  <input
                    type="tel"
                    value={emergencyForwardPhone}
                    onChange={(e) => setEmergencyForwardPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="+91 63612 09256"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white font-oswald uppercase">
                    After-Hours Voicemail Fallback
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    If closed, take detailed voicemails and send instant transcript to your Telegram.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={afterHoursVoicemail}
                  onChange={(e) => setAfterHoursVoicemail(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              {settingsSaved && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Settings Updated &amp; Synced to Live AI Agent!
                </span>
              )}
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-oswald uppercase text-xs transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                Save Receptionist Profile
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: CARRIER FORWARDING SETUP */}
        {activeTab === "forwarding" && (
          <div className="space-y-6">
            <CarrierPhone3DSimulator targetPhone="+18149613703" />
          </div>
        )}
      </main>

      {/* Footer */}
      <LandingFooter onOpenAuth={() => {}} />

      {/* Carrier Forwarding Modal */}
      <CarrierForwardingModal
        isOpen={forwardingModalOpen}
        onClose={() => setForwardingModalOpen(false)}
        targetPhone="+18149613703"
      />
    </div>
  );
}
