import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function LegacyPaymentSuccessPage({ searchParams }: Props) {
  const { orderId } = await searchParams;
  if (orderId) {
    redirect(`/cart/order-confirmation?orderId=${encodeURIComponent(orderId)}`);
  }
  redirect("/orders");
}
