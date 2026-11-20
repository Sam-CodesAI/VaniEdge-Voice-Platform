import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VaniEdge Receptionist — Autonomous AI Voice Receptionist for Business Calls",
  description:
    "Answer every business call on the 1st ring with zero phone number porting. Books appointments, answers customer FAQs, takes messages, and escalates emergencies.",
};

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
