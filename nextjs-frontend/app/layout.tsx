import "./globals.css";
import { Inter } from "next/font/google";
import Footer from "@/components/footer";
import AuthModalProvider from "@/components/authModalProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "V-Market",
  description: "Your one-stop marketplace for all products",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="flex flex-col min-h-screen bg-white text-gray-900">
        <AuthModalProvider>
          <main className="flex-1">{children}</main>
        </AuthModalProvider>
        <Footer />
      </body>
    </html>
  );
}
