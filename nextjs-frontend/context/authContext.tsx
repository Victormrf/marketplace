import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";

interface User {
  id: string;
  email: string;
  role: "customer" | "seller" | "admin";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  showAlert: boolean;
  alertPosition: { top: number; left: number } | null;
  setAlertPosition: (pos: { top: number; left: number }) => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertPosition, setAlertPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const hasAttemptedLoginRef = useRef(false);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        if (hasAttemptedLoginRef.current) {
          setShowAlert(true);
        }
        return;
      }

      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error("Erro ao buscar o usuário:", err);
      setUser(null);
    } finally {
      setLoading(false);
      hasAttemptedLoginRef.current = true;
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        showAlert,
        alertPosition,
        setAlertPosition,
        refetch: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro do AuthProvider");
  }
  return context;
};
