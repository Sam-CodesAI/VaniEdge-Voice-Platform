import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agency Master Console | VaniEdge Voice Platform",
  description:
    "Multi-tenant sovereign voice AI and telephony management for agencies and contact centers.",
};

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
