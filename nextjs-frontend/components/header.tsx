import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-8 py-2 shadow bg-white">
      <Link href="/" className="text-xl font-bold">
        <Image
          src="/v-market-logo.png"
          alt="v-market logo"
          width={80}
          height={80}
        />
      </Link>
      <Link
        href="/login"
        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 text-sm"
      >
        Sign In / Register
      </Link>
    </header>
  );
}
