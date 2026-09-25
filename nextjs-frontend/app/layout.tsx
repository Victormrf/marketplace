import "./globals.css";
import Footer from "@/components/footer";
import AuthModalProvider from "@/components/authModalProvider";
import { AuthProvider } from "@/context/authContext";

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
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-white text-gray-900">
        <AuthProvider>
          <AuthModalProvider>
            <main className="flex-1">{children}</main>
          </AuthModalProvider>
        </AuthProvider>
        <Footer />
      </body>
    </html>
  );
}
