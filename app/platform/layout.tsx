import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VaniEdge Platform — Enterprise Voice Telephony & Multi-Tenant Infrastructure",
  description:
    "Developer and agency console for multi-tenant voice agents, sub-5ms SutraDB vector memory, carrier trunks (Twilio, Exotel, SIP), sub-second failover watchdog, and OpenAPI 3.1 contracts.",
};

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
