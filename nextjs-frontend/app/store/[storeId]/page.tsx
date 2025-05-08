"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const DashboardClient = dynamic(() => import("../../../components/dashboard"), {
  ssr: false,
});

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") || "";
  return <DashboardClient storeId={storeId} />;
}
