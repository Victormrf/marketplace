"use client";
import { useState } from "react";
import LoginForm from "@/components/loginForm";
import RegisterForm from "@/components/registerForm";

type AuthPageModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AuthPageModal({ open, onClose }: AuthPageModalProps) {
  const [showRegister, setShowRegister] = useState(false);

  if (!open) return null;

  // Fecha o modal ao clicar no fundo
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md">
        {showRegister ? (
          <RegisterForm
            onBackToLogin={() => setShowRegister(false)}
            onClose={onClose}
          />
        ) : (
          <LoginForm
            onRegisterClick={() => setShowRegister(true)}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
