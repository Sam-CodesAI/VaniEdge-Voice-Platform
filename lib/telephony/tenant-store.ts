/**
 * VaniEdge-Pro Telephony Platform
 * Multi-Tenant Profile Registry & Knowledge Engine
 * 
 * Provides runtime resolution of business profiles, operating hours,
 * emergency keywords, and dispatch policies for any subscribed client.
 */

import { TenantProfile } from "./types";

// ==============================================================================
// PRODUCTION TENANT PRESETS
// ==============================================================================

export const APEX_HVAC_PROFILE: TenantProfile = {
  id: "apex-hvac",
  name: "Apex Heating & Air Conditioning",
  industry: "home_services",
  phone: process.env.TWILIO_PHONE_NUMBER || "+18149613703",
  emergencyNumbers: {
    primaryDispatcher: "+13035550100",
    onCallTechnician: "+13035550101",
    officeFallback: "+13035550102",
  },
  businessHours: {
    timezone: "America/Denver",
    schedule: {
      monday: { open: "08:00", close: "18:00" },
      tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" },
      thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" },
      saturday: { open: "09:00", close: "15:00" },
      sunday: { open: "10:00", close: "14:00", closed: true },
    },
  },
  knowledgeBase: {
    serviceArea: ["Denver", "Aurora", "Lakewood", "Littleton", "Centennial", "Thornton", "Highlands Ranch"],
    pricingRules: [
      {
        service: "Diagnostic & Dispatch Fee",
        price: "$89",
        note: "Completely waived if any repair or replacement is approved.",
      },
      {
        service: "Annual Furnace & AC Safety Tune-Up",
        price: "$99",
        note: "Includes comprehensive 21-point heat exchanger inspection and refrigerant check.",
      },
      {
        service: "After-Hours Emergency Dispatch",
        price: "$149",
        note: "Available 24/7 for gas leaks, carbon monoxide alarms, or zero heat in sub-freezing temperatures.",
      },
    ],
    emergencyKeywords: [
      "gas leak",
      "smell gas",
      "smelling gas",
      "smelling like gas",
      "smell like gas",
      "carbon monoxide",
      "no heat",
      "furnace out",
      "freezing",
      "water pouring",
      "water is pouring",
      "flooding from ac",
      "smoke from furnace",
      "electrical burning",
    ],
    faq: [
      {
        question: "Do you service mobile homes or commercial chillers?",
        answer: "We specialize strictly in residential single-family homes, townhomes, and light commercial split systems. We do not service ammonia commercial chillers or mobile homes.",
      },
      {
        question: "How quickly can a technician arrive for an emergency?",
        answer: "Our average emergency arrival time across the Denver metro area is 45 to 90 minutes.",
      },
      {
        question: "Are your technicians licensed and insured?",
        answer: "Yes, 100% NATE-certified, EPA-certified, background-checked, and fully insured in Colorado.",
      },
    ],
  },
  voiceConfig: {
    personaName: "Sarah",
    pollyVoice: "Polly.Joanna-Neural",
    language: "en-US",
    greeting: "Thank you for calling Apex Heating and Air Conditioning. I am Sarah, your AI service assistant. Are you calling for an urgent repair, a routine maintenance tune-up, or general pricing?",
    tcpaConsentNotice: "Notice: This call is recorded for dispatch quality and technician safety.",
  },
  bookingUrl: "https://cal.com/apex-hvac/service-booking",
  smsRescueTemplate: "Hi, this is Sarah from Apex Heating & Air. We noticed your call got disconnected! If you have an emergency or need to schedule service, reply directly here or book instantly: https://cal.com/apex-hvac/service-booking",
};

export const METRO_DENTAL_PROFILE: TenantProfile = {
  id: "metro-dental",
  name: "Metro Urgent Dental Center",
  industry: "healthcare",
  phone: "+18149613704",
  emergencyNumbers: {
    primaryDispatcher: "+13035550200",
    onCallTechnician: "+13035550201",
  },
  businessHours: {
    timezone: "America/Denver",
    schedule: {
      monday: { open: "07:30", close: "17:00" },
      tuesday: { open: "07:30", close: "17:00" },
      wednesday: { open: "07:30", close: "17:00" },
      thursday: { open: "07:30", close: "17:00" },
      friday: { open: "08:00", close: "14:00" },
      saturday: { open: "09:00", close: "13:00" },
      sunday: { open: "00:00", close: "00:00", closed: true },
    },
  },
  knowledgeBase: {
    serviceArea: ["Denver", "Glendale", "Cherry Creek", "Englewood"],
    pricingRules: [
      { service: "Emergency Triage & Limited Exam", price: "$79", note: "Includes emergency periapical X-ray." },
      { service: "Comprehensive New Patient Exam & Cleaning", price: "$149" },
    ],
    emergencyKeywords: [
      "knocked out tooth",
      "broken tooth",
      "bleeding mouth",
      "severe toothache",
      "swollen jaw",
      "facial swelling",
      "abscess",
    ],
    faq: [
      {
        question: "What should I do if a tooth was completely knocked out?",
        answer: "Handle the tooth by the crown only, do not scrub the root, place it in cold milk or saliva, and come in within 60 minutes for the highest re-implantation success rate.",
      },
    ],
  },
  voiceConfig: {
    personaName: "Emma",
    pollyVoice: "Polly.Joanna-Neural",
    language: "en-US",
    greeting: "Thank you for calling Metro Urgent Dental. I am Emma, your digital triage assistant. Are you calling regarding a dental emergency, scheduling an exam, or billing?",
    tcpaConsentNotice: "Notice: This call is recorded for patient care accuracy and medical documentation.",
  },
  bookingUrl: "https://cal.com/metro-dental/emergency",
  smsRescueTemplate: "Hi, this is Emma at Metro Urgent Dental. We noticed our call disconnected. If you're experiencing dental pain or bleeding, book your same-day triage slot immediately: https://cal.com/metro-dental/emergency",
};

export const PRECISION_PLUMBING_PROFILE: TenantProfile = {
  id: "precision-plumbing",
  name: "Precision Plumbing Pros",
  industry: "home_services",
  phone: "+18149613705",
  emergencyNumbers: {
    primaryDispatcher: "+13035550300",
    onCallTechnician: "+13035550301",
  },
  businessHours: {
    timezone: "America/Denver",
    schedule: {
      monday: { open: "07:00", close: "19:00" },
      tuesday: { open: "07:00", close: "19:00" },
      wednesday: { open: "07:00", close: "19:00" },
      thursday: { open: "07:00", close: "19:00" },
      friday: { open: "07:00", close: "19:00" },
      saturday: { open: "08:00", close: "16:00" },
      sunday: { open: "08:00", close: "16:00" },
    },
  },
  knowledgeBase: {
    serviceArea: ["Denver", "Boulder", "Broomfield", "Westminster", "Arvada"],
    pricingRules: [
      { service: "Plumbing Diagnostic & Dispatch", price: "$99", note: "Waived with repair." },
      { service: "Main Line Drain Clearing Special", price: "$149", note: "Up to 75 feet through accessible cleanout." },
      { service: "Water Heater Flush & Safety Check", price: "$129" },
    ],
    emergencyKeywords: [
      "burst pipe",
      "flooding",
      "sewer backup",
      "water heater leaking",
      "main line broke",
      "water won't turn off",
      "sewage smell",
    ],
    faq: [
      {
        question: "How do I shut off my main water valve?",
        answer: "Locate the brass shut-off valve near your water meter or where the main line enters your basement or crawlspace, and turn it 90 degrees clockwise.",
      },
    ],
  },
  voiceConfig: {
    personaName: "Mike",
    pollyVoice: "Polly.Matthew-Neural",
    language: "en-US",
    greeting: "Thanks for calling Precision Plumbing Pros. I'm Mike, the AI dispatch assistant. Do you have an active leak or emergency, or are you looking to schedule routine plumbing service?",
    tcpaConsentNotice: "Notice: This call is recorded for dispatch coordination and quality assurance.",
  },
  bookingUrl: "https://cal.com/precision-plumbing/dispatch",
  smsRescueTemplate: "Hi from Precision Plumbing Pros! We got disconnected. If you have an active leak, shut off your main valve and reply directly or book emergency dispatch here: https://cal.com/precision-plumbing/dispatch",
};

export const OAKWOOD_LEGAL_PROFILE: TenantProfile = {
  id: "oakwood-legal",
  name: "Oakwood Legal Defense",
  industry: "professional",
  phone: "+18149613706",
  emergencyNumbers: {
    primaryDispatcher: "+13035550400",
    onCallTechnician: "+13035550401",
  },
  businessHours: {
    timezone: "America/Denver",
    schedule: {
      monday: { open: "08:30", close: "17:30" },
      tuesday: { open: "08:30", close: "17:30" },
      wednesday: { open: "08:30", close: "17:30" },
      thursday: { open: "08:30", close: "17:30" },
      friday: { open: "08:30", close: "16:30" },
      saturday: { open: "00:00", close: "00:00", closed: true },
      sunday: { open: "00:00", close: "00:00", closed: true },
    },
  },
  knowledgeBase: {
    serviceArea: ["State of Colorado", "Denver County", "Arapahoe County", "Jefferson County"],
    pricingRules: [
      { service: "Initial Case Evaluation", price: "Free", note: "15-minute confidential consultation." },
      { service: "Misdemeanor Defense", price: "Flat Fee from $2,500" },
      { service: "Felony Representation", price: "Retainer from $5,000" },
    ],
    emergencyKeywords: [
      "arrested",
      "police custody",
      "jail booking",
      "warrant",
      "search warrant",
      "detained",
      "court tomorrow",
    ],
    faq: [
      {
        question: "What should I do if a family member was just arrested?",
        answer: "Advise them to politely exercise their 5th Amendment right to remain silent and request an attorney immediately. Do not discuss case details over recorded jail telephone lines.",
      },
    ],
  },
  voiceConfig: {
    personaName: "David",
    pollyVoice: "Polly.Matthew-Neural",
    language: "en-US",
    greeting: "Thank you for calling Oakwood Legal Defense. I am David, an automated case intake assistant. Please state the nature of your legal matter or if someone is currently in police custody.",
    tcpaConsentNotice: "Notice: This call is recorded for confidential attorney-client intake screening.",
  },
  bookingUrl: "https://cal.com/oakwood-legal/consultation",
  smsRescueTemplate: "Confidential intake alert from Oakwood Legal Defense: our call disconnected. If an attorney is needed urgently, schedule an intake review here: https://cal.com/oakwood-legal/consultation",
};

// ==============================================================================
// REGISTRY & RESOLUTION LOGIC
// ==============================================================================

const TENANT_REGISTRY = new Map<string, TenantProfile>([
  [APEX_HVAC_PROFILE.id, APEX_HVAC_PROFILE],
  [METRO_DENTAL_PROFILE.id, METRO_DENTAL_PROFILE],
  [PRECISION_PLUMBING_PROFILE.id, PRECISION_PLUMBING_PROFILE],
  [OAKWOOD_LEGAL_PROFILE.id, OAKWOOD_LEGAL_PROFILE],
]);

// Map phone number (normalized digits) to tenant ID
const PHONE_LOOKUP_MAP = new Map<string, string>();

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

// Populate phone lookup
for (const tenant of TENANT_REGISTRY.values()) {
  PHONE_LOOKUP_MAP.set(normalizePhone(tenant.phone), tenant.id);
}

/**
 * Resolve a tenant by the incoming dialed phone number (Twilio "To" parameter).
 * Falls back to default Apex HVAC if unmapped.
 */
export function getTenantByPhone(dialedPhone: string): TenantProfile {
  const normalized = normalizePhone(dialedPhone);
  const tenantId = PHONE_LOOKUP_MAP.get(normalized);
  if (tenantId && TENANT_REGISTRY.has(tenantId)) {
    return TENANT_REGISTRY.get(tenantId)!;
  }
  return APEX_HVAC_PROFILE;
}

/**
 * Resolve a tenant by unique identifier slug.
 */
export function getTenantById(id: string): TenantProfile {
  return TENANT_REGISTRY.get(id) || APEX_HVAC_PROFILE;
}

/**
 * List all available tenant presets.
 */
export function getAllTenants(): TenantProfile[] {
  return Array.from(TENANT_REGISTRY.values());
}

/**
 * Register or update a tenant profile at runtime.
 */
export function registerTenant(tenant: TenantProfile): void {
  TENANT_REGISTRY.set(tenant.id, tenant);
  PHONE_LOOKUP_MAP.set(normalizePhone(tenant.phone), tenant.id);
}

/**
 * Determine if the tenant's business is currently open based on operating schedule.
 */
export function checkBusinessHours(
  tenant: TenantProfile,
  date: Date = new Date()
): { isOpen: boolean; scheduleText: string } {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

  // Format current time into tenant's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tenant.businessHours.timezone,
    hour12: false,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "monday";
  const hourStr = parts.find((p) => p.type === "hour")?.value || "12";
  const minuteStr = parts.find((p) => p.type === "minute")?.value || "00";

  const dayKey = days.find((d) => d === weekdayStr) || "monday";
  const daySchedule = tenant.businessHours.schedule[dayKey];

  if (!daySchedule || daySchedule.closed) {
    return {
      isOpen: false,
      scheduleText: `Closed on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s`,
    };
  }

  const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
  const [openH, openM] = daySchedule.open.split(":").map(Number);
  const [closeH, closeM] = daySchedule.close.split(":").map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

  return {
    isOpen,
    scheduleText: `Open ${daySchedule.open} - ${daySchedule.close} (${tenant.businessHours.timezone})`,
  };
}
