"use client";

import React, { useState } from "react";
import {
  X,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Terminal,
  ShieldCheck,
  PhoneCall,
  Server,
  Activity,
  Play,
  CheckCircle2,
} from "lucide-react";
import { UserRecord, UserCredentials } from "@/lib/auth-store";

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onCredentialsUpdated: (newCredentials: UserCredentials) => void;
}

export default function CredentialsModal({
  isOpen,
  onClose,
  user,
  onCredentialsUpdated,
}: CredentialsModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateMessage, setRotateMessage] = useState<string | null>(null);

  // Live cURL Test Execution state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    latencyMs: number;
    status: number;
    response: string;
  } | null>(null);

  if (!isOpen || !user) return null;

  const credentials = user.credentials;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleRotateKey = async () => {
    if (!confirm("Are you sure you want to rotate your live API Key? Any production integration using the old key will immediately stop working.")) {
      return;
    }

    setIsRotating(true);
    setRotateMessage(null);

    try {
      const res = await fetch("/api/auth/credentials/rotate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json() as { success?: boolean; credentials?: UserCredentials; error?: string };
      if (res.ok && data.credentials) {
        onCredentialsUpdated(data.credentials);
        setRotateMessage("New API key generated and activated. Previous key revoked.");
        setTimeout(() => setRotateMessage(null), 4000);
      } else {
        alert(data.error || "Failed to rotate API credentials.");
      }
    } catch {
      alert("Network error while rotating API credentials.");
    } finally {
      setIsRotating(false);
    }
  };

  const runLiveApiTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.apiKey}`,
        },
        body: JSON.stringify({
          callerNumber: "+919876543210",
          calledNumber: credentials.assignedPhoneNumber,
          category: "clinic",
          transcript: "Namaste, need doctor consultation slot.",
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      const json = await res.json();

      setTestResult({
        latencyMs: elapsed,
        status: res.status,
        response: JSON.stringify(json, null, 2),
      });
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - start);
      setTestResult({
        latencyMs: elapsed,
        status: 500,
        response: JSON.stringify({ error: err instanceof Error ? err.message : "Request failed" }, null, 2),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://vaniedge.vercel.app";
  const curlSnippet = `curl -X POST "${origin}/api/dispatch" \\
  -H "Authorization: Bearer ${credentials.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "callerNumber": "+919876543210",
    "calledNumber": "${credentials.assignedPhoneNumber}",
    "category": "clinic",
    "transcript": "Doctor appointment booking"
  }'`;

  const minutesPercent = Math.min(100, Math.round((user.voiceMinutesUsed / user.voiceMinutesTotal) * 100));

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl my-8 rounded-2xl bg-white border-2 border-slate-200 shadow-2xl p-6 sm:p-8 overflow-hidden text-black">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-black hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close Credentials Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-oswald uppercase tracking-tight text-black">
                Developer Credentials &amp; SIP Trunks
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-oswald uppercase font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {user.tier} Tier
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Production access tokens, Bangalore SIP gateway routing, and webhook secrets for {user.company}.
            </p>
          </div>
        </div>

        {/* Voice Usage & Quota Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between text-xs font-oswald font-bold uppercase mb-1.5">
            <span className="text-black flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Voice Minutes Quota</span>
            </span>
            <span className="text-black">
              {user.voiceMinutesUsed} / {user.voiceMinutesTotal} MINS ({user.voiceMinutesTotal - user.voiceMinutesUsed} remaining)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, minutesPercent)}%` }}
            />
          </div>
        </div>

        {rotateMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{rotateMessage}</span>
          </div>
        )}

        {/* Credentials Grid */}
        <div className="space-y-4 text-xs">
          {/* 1. Live API Key */}
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-oswald font-bold uppercase text-black text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live REST &amp; WebSocket API Key</span>
              </span>
              <button
                type="button"
                onClick={handleRotateKey}
                disabled={isRotating}
                className="text-[11px] font-oswald font-bold uppercase text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isRotating ? "animate-spin" : ""}`} />
                <span>Rotate Key</span>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type={showApiKey ? "text" : "password"}
                readOnly
                value={credentials.apiKey}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-black font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-black hover:bg-slate-100 transition-colors"
                title={showApiKey ? "Hide Key" : "Show Key"}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(credentials.apiKey, "apiKey")}
                className="px-3 py-1.5 rounded-lg bg-black text-white hover:bg-slate-800 font-oswald font-bold uppercase text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedField === "apiKey" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Assigned Bangalore DID Number & SIP Endpoint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Phone Number */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
              <div className="font-oswald font-bold uppercase text-black text-xs flex items-center gap-1.5 mb-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                <span>Assigned Bangalore DID</span>
              </div>
              <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-black">
                <span>{credentials.assignedPhoneNumber}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.assignedPhoneNumber, "phone")}
                  className="hover:text-emerald-700 transition-colors ml-2"
                  title="Copy Phone"
                >
                  {copiedField === "phone" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* SIP Gateway Domain */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
              <div className="font-oswald font-bold uppercase text-black text-xs flex items-center gap-1.5 mb-1.5">
                <Server className="w-3.5 h-3.5 text-sky-600" />
                <span>SIP Trunk Gateway</span>
              </div>
              <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-black">
                <span className="truncate">{credentials.sipEndpoint}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.sipEndpoint, "sip")}
                  className="hover:text-emerald-700 transition-colors ml-2"
                  title="Copy SIP"
                >
                  {copiedField === "sip" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Webhook Signing Secret */}
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-oswald font-bold uppercase text-black text-xs flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-600" />
                <span>Webhook Signature Secret (HMAC-SHA256)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-600">Header: X-VaniEdge-Signature</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="password"
                readOnly
                value={credentials.webhookSecret}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-black font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(credentials.webhookSecret, "webhook")}
                className="px-3 py-1.5 rounded-lg bg-black text-white hover:bg-slate-800 font-oswald font-bold uppercase text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedField === "webhook" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === "webhook" ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* 4. Ready-to-Run cURL Snippet */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-oswald font-bold uppercase text-xs text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Production cURL Quickstart</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runLiveApiTest}
                  disabled={isTesting}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-oswald font-bold uppercase text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Play className={`w-3 h-3 fill-white ${isTesting ? "animate-spin" : ""}`} />
                  <span>{isTesting ? "Executing..." : "Test Key Live"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(curlSnippet, "curl")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-oswald font-bold uppercase text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedField === "curl" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "curl" ? "Copied!" : "Copy cURL"}</span>
                </button>
              </div>
            </div>
            <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto text-emerald-300 p-2 rounded bg-black/50 border border-slate-800">
              {curlSnippet}
            </pre>
          </div>

          {/* Live Test Response Drawer */}
          {testResult && (
            <div className="bg-slate-50 border-2 border-emerald-500 rounded-xl p-3.5 animate-in fade-in">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-oswald font-bold uppercase text-emerald-700 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verified Live Dispatch Response (HTTP {testResult.status})</span>
                </span>
                <span className="font-mono text-xs font-bold text-black bg-white px-2 py-0.5 rounded border border-slate-300">
                  {testResult.latencyMs}ms Latency
                </span>
              </div>
              <pre className="text-[11px] font-mono bg-white p-2.5 rounded-lg border border-slate-200 text-black overflow-x-auto">
                {testResult.response}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>Signed in as <strong className="text-black">{user.email}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-black text-white hover:bg-slate-800 font-oswald font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
