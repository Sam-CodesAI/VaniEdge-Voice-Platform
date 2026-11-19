"use client";

import React, { useState, useEffect } from "react";
import { Plus, Users, PhoneCall, Settings, Activity, Building, ArrowRight, ShieldCheck, Zap } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  category: string;
  twilioPhone: string;
  twilioSid: string;
  webhookUrl: string;
  monthlyCalls: number;
  status: "active" | "provisioning" | "suspended";
  createdAt: string;
  logoUrl?: string;
  brandColor?: string;
}

interface AgencyMasterConsoleProps {
  onOpenAuth?: (mode: "signin" | "signup") => void;
  currentUser?: { name?: string; email?: string } | null;
}

const DEMO_AGENCY_TENANTS: Tenant[] = [
  {
    id: "tnt_careplus_01",
    name: "CarePlus Pediatric Clinic",
    category: "clinic",
    twilioPhone: "+91 80 4725 9000",
    twilioSid: "AC_careplus_demo",
    webhookUrl: "https://vaniedge.vercel.app/api/voice/incoming?tenantId=clinic-1",
    monthlyCalls: 148,
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    brandColor: "#0ea5e9",
  },
  {
    id: "tnt_apexhvac_02",
    name: "Apex 24/7 HVAC Emergency",
    category: "auto",
    twilioPhone: "+91 80 4725 9000",
    twilioSid: "AC_apex_demo",
    webhookUrl: "https://vaniedge.vercel.app/api/voice/incoming?tenantId=apex-hvac",
    monthlyCalls: 312,
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    brandColor: "#f59e0b",
  },
  {
    id: "tnt_royalfeast_03",
    name: "Royal Feast Kitchen & Dining",
    category: "restaurant",
    twilioPhone: "+91 80 4725 9000",
    twilioSid: "AC_royal_demo",
    webhookUrl: "https://vaniedge.vercel.app/api/voice/incoming?tenantId=restaurant-1",
    monthlyCalls: 89,
    status: "provisioning",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    brandColor: "#10b981",
  },
];

export function AgencyMasterConsole({ onOpenAuth, currentUser }: AgencyMasterConsoleProps = {}) {
  const [tenants, setTenants] = useState<Tenant[]>(DEMO_AGENCY_TENANTS);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCat, setNewClientCat] = useState("clinic");

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editColor, setEditColor] = useState("");
  const [editLogo, setEditLogo] = useState("");

  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/agency/tenants");
      if (res.ok) {
        const data = (await res.json()) as { tenants: Tenant[] };
        setTenants(data.tenants || []);
        setIsDemoMode(false);
      } else {
        setIsDemoMode(true);
        setTenants(DEMO_AGENCY_TENANTS);
      }
    } catch {
      setIsDemoMode(true);
      setTenants(DEMO_AGENCY_TENANTS);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleProvision = async () => {
    setIsProvisioning(true);
    setProvisionError(null);
    try {
      const res = await fetch("/api/agency/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName, category: newClientCat }),
      });
      
      if (res.ok) {
        await fetchTenants();
        setShowModal(false);
        setNewClientName("");
      } else {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 401) {
          setProvisionError("Authentication required: Please sign in or register to provision production client infrastructure.");
        } else {
          setProvisionError(errJson.error || `Provisioning failed (HTTP ${res.status})`);
        }
      }
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : "Network error during provisioning");
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!editingTenant) return;
    const res = await fetch(`/api/agency/tenants/${editingTenant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor: editColor, logoUrl: editLogo }),
    });
    if (res.ok) {
      await fetchTenants();
      setEditingTenant(null);
    }
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-white rounded-xl border border-white/10 overflow-hidden font-sans">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wider font-oswald text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-400" />
            Bridge Builders AI — Master Console
          </h2>
          <p className="text-sm text-gray-400 mt-1">Manage active implementations and deploy 1-click infrastructure.</p>
        </div>
        <button
          onClick={() => {
            setProvisionError(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Provision New Client
        </button>
      </div>

      {/* Demo Preview Banner */}
      {isDemoMode && (
        <div className="bg-blue-950/40 border-b border-blue-500/20 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span>
              <strong>Agency Demo Mode:</strong> Viewing preview enterprise tenants. Sign in to your agency account to provision and manage live client lines.
            </span>
          </div>
          {onOpenAuth && (
            <button
              type="button"
              onClick={() => onOpenAuth("signin")}
              className="px-3 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 font-medium transition-colors shrink-0 cursor-pointer"
            >
              Sign In to Deploy Live
            </button>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 border-b border-white/10">
        <div className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Active Tenants</p>
            <p className="text-2xl font-bold">{tenants.filter(t => t.status === "active").length}</p>
          </div>
        </div>
        <div className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <PhoneCall className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Global Calls (30d)</p>
            <p className="text-2xl font-bold">{tenants.reduce((acc, t) => acc + t.monthlyCalls, 0)}</p>
          </div>
        </div>
        <div className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Watchdog Uptime</p>
            <p className="text-2xl font-bold text-green-400">99.99%</p>
          </div>
        </div>
      </div>

      {/* Tenant List */}
      <div className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/40 text-gray-400 border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-medium">Client / Tenant Name</th>
              <th className="px-6 py-4 font-medium">Assigned Phone Line</th>
              <th className="px-6 py-4 font-medium">Webhook Binding</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-xs font-bold uppercase border border-white/10">
                      {t.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{t.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{t.category} Module</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-gray-300">{t.twilioPhone}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" style={{ backgroundColor: t.brandColor || "#22c55e" }} />
                    <span className="font-mono text-xs text-gray-400 truncate max-w-[150px]">{t.webhookUrl}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {t.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                      <Zap className="w-3 h-3" /> Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium border border-yellow-500/20">
                      <Activity className="w-3 h-3 animate-spin" /> Provisioning...
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => {
                       setEditingTenant(t);
                       setEditColor(t.brandColor || "#ffffff");
                       setEditLogo(t.logoUrl || "");
                    }}
                    className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                    title="White-label Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No tenants found. Provision your first client.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Provisioning Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold font-oswald text-white">Provision New Client Infrastructure</h3>
              <p className="text-sm text-gray-400 mt-1">Automatically assigns a Twilio number and creates a dedicated vector memory space.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Client Name</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Apex Plumbing"
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Industry Module</label>
                <select
                  value={newClientCat}
                  onChange={(e) => setNewClientCat(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="clinic">Clinic / Healthcare</option>
                  <option value="restaurant">Restaurant / Dining</option>
                  <option value="auto">Auto Repair / Towing</option>
                  <option value="general">General Reception</option>
                </select>
              </div>

              {provisionError && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
                  <p className="font-semibold mb-1">Provisioning Error:</p>
                  <p>{provisionError}</p>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        onOpenAuth("signin");
                      }}
                      className="mt-2 text-xs underline text-blue-300 hover:text-white"
                    >
                      Click here to sign in now →
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
                disabled={isProvisioning}
              >
                Cancel
              </button>
              <button
                onClick={handleProvision}
                disabled={!newClientName || isProvisioning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isProvisioning ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" /> Provisioning...
                  </>
                ) : (
                  <>
                    Deploy Client <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Settings Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold font-oswald text-white">White-Label Configuration</h3>
              <p className="text-sm text-gray-400 mt-1">Customize the BridgeView branding for {editingTenant.name}.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Brand Hex Color</label>
                <div className="flex gap-2 items-center">
                   <div className="w-8 h-8 rounded border border-white/10" style={{ backgroundColor: editColor || "#ffffff" }} />
                   <input
                     type="text"
                     value={editColor}
                     onChange={(e) => setEditColor(e.target.value)}
                     placeholder="#0ea5e9"
                     className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                   />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Company Logo URL</label>
                <input
                  type="text"
                  value={editLogo}
                  onChange={(e) => setEditLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
              <button
                onClick={() => setEditingTenant(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
