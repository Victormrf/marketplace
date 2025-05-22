import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-green-600">
          Payment Successful!
        </h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
          Thank you for your purchase. Your order has been confirmed.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block px-4 py-2 bg-slate-700 text-white rounded-lg"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
