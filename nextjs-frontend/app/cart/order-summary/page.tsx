import { redirect } from "next/navigation";

export default function LegacyOrderSummaryPage() {
  redirect("/cart/checkout");
}
