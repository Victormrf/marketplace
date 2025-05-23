import Link from "next/link";
import { Check, Home, Package } from "lucide-react";

export default function PaymentSuccessPage() {
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
            href="/orders/order-005/tracking"
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
