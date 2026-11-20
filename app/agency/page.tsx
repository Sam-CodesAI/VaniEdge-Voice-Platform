"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgencyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/platform");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center font-mono text-sm">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400">Redirecting to VaniEdge Platform Console...</p>
      </div>
    </div>
  );
}
