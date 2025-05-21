"use client";
import { useState, useCallback /*useEffect*/ } from "react";
import Header from "@/components/header";
import AuthPageModal from "@/components/authPageModal";
// import { usePathname, useRouter } from "next/navigation";

export default function AuthModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [headerRefresh, setHeaderRefresh] = useState(0);
  // const router = useRouter();
  // const pathname = usePathname();

  // useEffect(() => {
  //   async function checkAuth() {
  //     try {
  //       const res = await fetch("http://localhost:8000/users/me", {
  //         credentials: "include",
  //       });

  //       if (
  //         !res.ok &&
  //         (pathname?.includes("/store/") || pathname?.includes("/dashboard"))
  //       ) {
  //         router.push("/");
  //       }
  //     } catch (error) {
  //       console.error("Auth check failed:", error);
  //       if (pathname?.includes("/store/") || pathname?.includes("/dashboard")) {
  //         router.push("/");
  //       }
  //     }
  //   }

  //   checkAuth();
  // }, [router, pathname]);

  const handleAuthSuccess = useCallback(() => {
    setOpen(false);
    setHeaderRefresh((prev) => prev + 1);
  }, []);

  return (
    <>
      <Header
        onAuthClick={() => setOpen(true)}
        refreshTrigger={headerRefresh}
      />
      <AuthPageModal
        open={open}
        onClose={() => setOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
      {children}
    </>
  );
}
