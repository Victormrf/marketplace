"use client";
import { useState, useCallback } from "react";
import Header from "@/components/header";
import AuthPageModal from "@/components/authPageModal";

export default function AuthModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [headerRefresh, setHeaderRefresh] = useState(0);

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
