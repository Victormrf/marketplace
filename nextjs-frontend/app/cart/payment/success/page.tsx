"use client";

import Link from "next/link";
import { Check, Home, Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartItem } from "@/types/cartItem";

export default function PaymentSuccessPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const hasCreatedOrder = useRef(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        if (hasCreatedOrder.current) {
          return;
        }

        hasCreatedOrder.current = true;

        // 1. Return customer data:
        const customerRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/customers/`,
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (!customerRes.ok) throw new Error("Error returning customer");
        const customerData = await customerRes.json();

        // 2. Return cart-items data:
        const cartItemsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cart-items/`,
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (!cartItemsRes.ok) throw new Error("Error returning cart items");
        const cartItemsData = await cartItemsRes.json();

        // 3. create order
        const orderData = {
          customerId: customerData.profile.id,
          items: cartItemsData.map((item: CartItem) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        };

        const orderRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/orders/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderData),
            credentials: "include",
          }
        );

        if (!orderRes.ok) throw new Error("Error creating order");
        const orderResponseObj = await orderRes.json();
        setOrderId(orderResponseObj.newOrder.id);

        // 4. create delivery
        const deliveryData = {
          orderId: orderResponseObj.newOrder.id,
          status: "SEPARATED",
          trackingCode: "123456789",
        };

        const deliveryRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/delivery/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(deliveryData),
            credentials: "include",
          }
        );
        if (!deliveryRes.ok) throw new Error("Error creating delivery");

        // 5. Delete cart-items
        const clearCartRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cart-items/clear`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
        if (!clearCartRes.ok) throw new Error("Error clearing user cart");
      } catch (error) {
        console.error("Error creating order:", error);
        hasCreatedOrder.current = false;
      }
    }
    fetchOrder();
  }, []);

  return (
    <div className="h-[calc(88vh-80px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center px-4 py-8 rounded-xl bg-white shadow-lg dark:bg-gray-800 max-w-md mx-auto">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center dark:bg-green-900">
            <Check className="w-8 h-8 text-slate-600 dark:text-green-400" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-slate-600 dark:text-green-400 mb-4">
          Payment Successful!
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          Thank you for your purchase. Your order has been confirmed and will be
          processed soon.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Home
          </Link>

          <Link
            href={orderId ? `/orders/${orderId}/tracking` : "/"}
            className="inline-flex items-center px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Package className="w-4 h-4 mr-2" />
            Track Order
          </Link>
        </div>
      </div>
    </div>
  );
}
