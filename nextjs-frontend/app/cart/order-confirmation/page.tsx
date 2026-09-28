import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function OrderConfirmationPage({ searchParams }: Props) {
  const { orderId } = await searchParams;
  if (!orderId) redirect("/orders");
  redirect(`/orders/${encodeURIComponent(orderId)}`);
}
