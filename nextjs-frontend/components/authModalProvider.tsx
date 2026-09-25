"use client";
import { useState } from "react";
import Header from "@/components/header";
import AuthPageModal from "@/components/authPageModal";

export default function AuthModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const handleAuthSuccess = () => {
    setOpen(false);
  };

  return (
    <>
      <Header onAuthClick={() => setOpen(true)} />
      <AuthPageModal
        open={open}
        onClose={() => setOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
      {children}
    </>
  );
}
