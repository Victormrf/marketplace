"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import { getCurrentUser } from "@/services/user";
import type { AuthenticatedUserDto } from "@/types/auth";

interface AuthContextType {
  user: AuthenticatedUserDto | null;
  loading: boolean;
  setUser: (user: AuthenticatedUserDto | null) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      setUser(await getCurrentUser());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return;
      }

      // A 403 or network failure does not mean the identity is invalid.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    void refreshSession();

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro do AuthProvider");
  }
  return context;
}
