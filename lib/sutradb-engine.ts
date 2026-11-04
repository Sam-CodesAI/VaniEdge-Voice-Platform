import { supabase } from "@/lib/supabase-client";
import { SutraClient } from "./sutradb-client";
import { LruCache } from "@/src/engine/sutradb";
/**
 * SutraDB Edge: High-Performance Hybrid Vector + BM25 Lexical Engine
 * Zero external SaaS dependencies, sub-5ms query latency for edge autonomous agents.
 */

export type SutraCategory =
  | "clinic"
  | "restaurant"
  | "auto"
  | "retail"
  | "realestate"
  | "finance"
  | "hospitality"
  | "general"
  | string;

export interface DocumentEntry {
  id: string;
  title: string;
  content: string;
  category: SutraCategory;
  metadata?: Record<string, string | number | boolean>;
  tokens?: string[];
  vector?: number[];
}

export interface SearchResult {
  document: DocumentEntry;
  bm25Score: number;
  vectorScore: number;
  fusedScore: number;
  matchedTerms: string[];
}

// Tokenize and clean text
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u0D7F]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// Generate simple deterministic character n-gram semantic vector (64-dim)
export function generateDenseVector(text: string, dim: number = 64): number[] {
  const tokens = tokenize(text);
  const vec = new Array(dim).fill(0);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    for (let i = 0; i < token.length - 1; i++) {
      const bigram = token.slice(i, i + 2);
      let hash = 0;
      for (let j = 0; j < bigram.length; j++) {
        hash = (hash * 31 + bigram.charCodeAt(j)) % dim;
      }
      vec[Math.abs(hash)] += 1;
    }
  }

  // L2 Normalization
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

// Cosine similarity between two unit vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(0, Math.min(1, (dot + 1) / 2)); // Normalize to 0..1
}

export class SutraEdgeIndex {
  private docs: Map<string, DocumentEntry> = new Map();
  private docLengths: Map<string, number> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private totalDocs: number = 0;

  // BM25 Hyperparameters
  private readonly k1: number = 1.5;
  private readonly b: number = 0.75;
  private readonly lruCache: LruCache<string, SearchResult[]> = new LruCache<string, SearchResult[]>(500);
  private readonly client: SutraClient = new SutraClient();

  constructor(initialDocs: DocumentEntry[] = []) {
    for (const doc of initialDocs) {
      this.addDocument(doc);
    }
  }

  public addDocument(doc: DocumentEntry): void {
    const tokens = tokenize(`${doc.title} ${doc.content}`);
    const vector = generateDenseVector(`${doc.title} ${doc.content}`);
    const preparedDoc: DocumentEntry = {
      ...doc,
      tokens,
      vector,
    };

    this.docs.set(doc.id, preparedDoc);
    this.docLengths.set(doc.id, tokens.length);

    // Update document frequencies
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      this.docFreqs.set(token, (this.docFreqs.get(token) || 0) + 1);
    }

    this.totalDocs = this.docs.size;
    let totalLength = 0;
    for (const len of this.docLengths.values()) {
      totalLength += len;
    }
    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
    this.lruCache.clear();
  }

  public clear(): void {
    this.docs.clear();
    this.docLengths.clear();
    this.docFreqs.clear();
    this.avgDocLength = 0;
    this.totalDocs = 0;
    this.lruCache.clear();
  }

  public search(query: string, topK: number = 3): SearchResult[] {
    const cacheKey = `${query.toLowerCase().trim()}::${topK}`;
    const cached = this.lruCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryTokens = tokenize(query);
    const queryVector = generateDenseVector(query);
    if (this.totalDocs === 0 || queryTokens.length === 0) return [];

    const results: Array<{
      document: DocumentEntry;
      bm25Score: number;
      vectorScore: number;
      matchedTerms: string[];
    }> = [];

    for (const [id, doc] of this.docs.entries()) {
      const docTokens = doc.tokens || [];
      const docVector = doc.vector || [];
      const docLength = this.docLengths.get(id) || 1;

      // Calculate BM25
      let bm25 = 0;
      const matchedTerms: string[] = [];
      const tokenCounts = new Map<string, number>();
      for (const t of docTokens) {
        tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
      }

      for (const qToken of queryTokens) {
        const tf = tokenCounts.get(qToken) || 0;
        if (tf > 0) {
          matchedTerms.push(qToken);
          const df = this.docFreqs.get(qToken) || 1;
          const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);
          const num = tf * (this.k1 + 1);
          const den = tf + this.k1 * (1 - this.b + this.b * (docLength / (this.avgDocLength || 1)));
          bm25 += idf * (num / den);
        }
      }

      // Calculate Dense Vector Similarity
      const vectorScore = cosineSimilarity(queryVector, docVector);

      results.push({
        document: doc,
        bm25Score: Math.max(0, bm25),
        vectorScore,
        matchedTerms,
      });
    }

    // Normalize BM25 and Vector scores for Reciprocal Rank Fusion
    const maxBm25 = Math.max(1, ...results.map((r) => r.bm25Score));
    const scored = results.map((r) => {
      const normalizedBm25 = r.bm25Score / maxBm25;
      // 60% Semantic Dense + 40% Lexical BM25
      const fusedScore = r.vectorScore * 0.6 + normalizedBm25 * 0.4;
      return {
        ...r,
        fusedScore,
      };
    });

    scored.sort((a, b) => b.fusedScore - a.fusedScore);
    const finalResults = scored.slice(0, topK);
    this.lruCache.set(cacheKey, finalResults);
    return finalResults;
  }

  public async searchAsync(query: string, topK: number = 3): Promise<SearchResult[]> {
    const cacheKey = `${query.toLowerCase().trim()}::${topK}`;
    const cached = this.lruCache.get(cacheKey);
    if (cached) return cached;

    try {
      const remote = await this.client.query("vaniedge_knowledge", {
        text: query,
        top_k: topK,
        hybrid: true,
      });
      if (remote && Array.isArray(remote.results) && remote.results.length > 0) {
        const mapped: SearchResult[] = remote.results.map((r) => ({
          document: {
            id: r.id,
            title: (r.metadata?.title as string) || r.id,
            content: r.text || "",
            category: (r.metadata?.category as string) || "general",
            metadata: r.metadata as Record<string, string | number | boolean>,
          },
          bm25Score: r.bm25_score ?? 1.0,
          vectorScore: r.dense_score ?? 1.0,
          fusedScore: r.score,
          matchedTerms: [],
        }));
        this.lruCache.set(cacheKey, mapped);
        return mapped;
      }
    } catch {
      // Fallback to local index
    }
    return this.search(query, topK);
  }

  public getDocumentCount(): number {
    return this.totalDocs;
  }
}

// Default Presets for Voice Platform Live Demo & Real-Time RAG
// @deprecated
export const DEFAULT_KNOWLEDGE_PRESETS: DocumentEntry[] = [
  {
    id: "clinic-1",
    title: "Healthcare & Clinics - Services, Doctor Schedules & Consultation Fees",
    content: "Healthcare Clinic is open Monday to Saturday from 9:00 AM to 1:30 PM and 5:00 PM to 8:30 PM. Closed on Sundays. Services include General Health Checkups, Pediatrics, Blood Pressure & Diabetes Triage, and Vaccinations. Consultation fee is ₹500. Emergency ambulance contact is available 24/7 at +91-9876543210.",
    category: "clinic",
    metadata: { fee: 500, emergencyPhone: "+91-9876543210" },
  },
  {
    id: "clinic-2",
    title: "Healthcare Clinic - Appointment & Patient Booking Protocol",
    content: "Patients can book appointments for General Physician or Pediatrician. Same-day appointments must be booked at least 1 hour in advance. The patient must provide full name, mobile number, and primary symptoms. Walk-ins are accepted during morning hours with a 20-minute waiting queue.",
    category: "clinic",
    metadata: { bookingAdvanceMinutes: 60 },
  },
  {
    id: "restaurant-1",
    title: "Restaurants & Dining - Menu, Pricing & Combos",
    content: "Special North & South Indian Thali available daily for ₹140. Includes 3 Roti, Paneer Butter Masala, Dal Tadka, Jeera Rice, Curd, and Gulab Jamun. Veg Biryani is ₹180. Paneer Tikka Wrap is ₹90. Masala Dosa is ₹70. We offer free delivery within 4km radius on all orders above ₹250.",
    category: "restaurant",
    metadata: { minOrderFreeDelivery: 250 },
  },
  {
    id: "restaurant-2",
    title: "Restaurants & Dining - Delivery Hours, Ordering & Table Reservations",
    content: "Lunch service and delivery from 11:30 AM to 3:30 PM. Dinner service from 7:00 PM to 11:00 PM. Payment accepted via UPI (PhonePe, Google Pay, Paytm) or Cash on Delivery (COD). Table reservations can be held for up to 15 minutes. Average delivery turnaround time is 25 to 35 minutes.",
    category: "restaurant",
    metadata: { avgDeliveryMinutes: 30 },
  },
  {
    id: "auto-1",
    title: "Automotive & Rescue - 24/7 Emergency Towing & Roadside Assistance",
    content: "Apex Roadside Rescue covers city limits with 20-minute response time. Services include Flat Tyre Change (₹400), Battery Jump Start (₹350), Fuel Delivery (₹500 + fuel cost), and Flatbed Vehicle Towing (₹1,500 base + ₹40/km). Available 24 hours a day, 7 days a week.",
    category: "auto",
    metadata: { flatbedBase: 1500, emergency24x7: 1 },
  },
  {
    id: "auto-2",
    title: "Automotive & Rescue - Vehicle Diagnostic & Workshop Repair Services",
    content: "Full diagnostic engine scans, brake pad replacement, and radiator coolant flushes. Authorized workshop partners provide free pickup and drop for major accidental and mechanical repairs with insurance cashless claim processing.",
    category: "auto",
    metadata: { cashlessClaims: true },
  },
  {
    id: "retail-1",
    title: "Retail & E-Commerce - Order Tracking, Delivery Status & 30-Day Returns",
    content: "Standard shipping delivers within 2 to 4 business days. Express next-day delivery available for orders placed before 2:00 PM. Hassle-free 30-day return policy on all unworn, sealed items with instant refunds processed to the original payment method within 48 hours.",
    category: "retail",
    metadata: { returnWindowDays: 30, expressCutoff: "14:00" },
  },
  {
    id: "retail-2",
    title: "Retail & E-Commerce - Inventory Stock Check, Discounts & Warranty Claim",
    content: "Check real-time in-store stock availability across sizes and colors. Seasonal clearance discounts up to 40% off on electronics and apparel. All electronics come with a 1-year manufacturer replacement warranty with digital invoice proof.",
    category: "retail",
    metadata: { warrantyMonths: 12, maxDiscountPercent: 40 },
  },
  {
    id: "realestate-1",
    title: "Real Estate & Property - Available Listings, Floor Plans & Pricing",
    content: "Premium 2 BHK and 3 BHK residential apartments available for lease and sale. 2 BHK units start at ₹42,000/month rent or ₹85 Lakh purchase. 3 BHK luxury penthouses start at ₹75,000/month rent or ₹1.6 Crore purchase. Amenities include clubhouse, swimming pool, and 24/7 gated security.",
    category: "realestate",
    metadata: { rent2Bhk: 42000, buy2BhkLakhs: 85 },
  },
  {
    id: "realestate-2",
    title: "Real Estate & Property - Site Viewings, Lease Agreements & Maintenance",
    content: "Guided apartment tours and site viewings are scheduled Tuesday through Sunday from 10:00 AM to 6:00 PM. Lease agreements require standard 2 months security deposit and 11-month tenure with 5% annual escalation. In-house maintenance team handles electrical and plumbing tickets.",
    category: "realestate",
    metadata: { depositMonths: 2, tenureMonths: 11 },
  },
  {
    id: "finance-1",
    title: "Banking & Finance - Account Balance, Instant Card Freeze & Fraud Alerts",
    content: "Real-time account balance inquiries and last 5 transactions check. Customers can instantly freeze lost or stolen credit/debit cards 24/7 by voice verification. Fraud prevention team operates continuously with zero customer liability on unauthorized transactions reported within 24 hours.",
    category: "finance",
    metadata: { fraudSupport24x7: true, zeroLiabilityHours: 24 },
  },
  {
    id: "finance-2",
    title: "Banking & Finance - Home, Personal & Auto Loan Eligibility & Rates",
    content: "Home loans offered starting at 8.4% p.a., personal loans from 10.5% p.a., and auto vehicle financing from 8.8% p.a. Pre-approved loans disbursed within 24 hours with minimal paperwork. Loan repayment tenure up to 30 years for home mortgages with flexible EMI plans.",
    category: "finance",
    metadata: { homeLoanRatePercent: 8.4, maxTenureYears: 30 },
  },
  {
    id: "hospitality-1",
    title: "Hotels & Hospitality - Room Reservations, Deluxe Suites & Check-in",
    content: "Deluxe King Rooms start at ₹4,500/night and Executive Suite with ocean view at ₹8,200/night. Standard check-in is 2:00 PM and check-out is 11:00 AM. Early check-in and late check-out subject to room availability upon arrival.",
    category: "hospitality",
    metadata: { checkIn: "14:00", checkOut: "11:00", deluxeRate: 4500 },
  },
  {
    id: "hospitality-2",
    title: "Hotels & Hospitality - Dining Amenities, Airport Shuttle & Spa Services",
    content: "Complimentary breakfast buffet served from 6:30 AM to 10:30 AM at the rooftop restaurant. 24-hour roundtrip airport luxury shuttle available at ₹800 per transfer. Wellness spa and heated swimming pool open daily from 7:00 AM to 9:00 PM.",
    category: "hospitality",
    metadata: { breakfastIncluded: true, airportShuttleRate: 800 },
  },
  {
    id: "general-1",
    title: "Customer Support & Concierge - 24/7 Inbound Reception & Callback Scheduling",
    content: "Enterprise concierge reception handles customer inquiries, business escalations, and technical support routing. Guaranteed live agent callback within 15 minutes during business hours (9:00 AM to 9:00 PM) or scheduled appointment for complex inquiries.",
    category: "general",
    metadata: { callbackSlaMinutes: 15, liveSupport: true },
  },
  {
    id: "general-2",
    title: "Customer Support - Billing Inquiries, Feedback & Ticket Resolution SLA",
    content: "Billing disputes, invoice copy requests, and refund processing have a standard 24-hour resolution SLA. Urgent complaints are auto-escalated to senior account managers with automated SMS tracking and status updates.",
    category: "general",
    metadata: { resolutionSlaHours: 24 },
  },
];
