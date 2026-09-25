"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Mail, Phone, Store } from "lucide-react";
import { ProfileFormModal } from "@/components/profileModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { getMyCustomerProfile } from "@/services/customer";
import { getMySellerProfile } from "@/services/seller";
import type { UserProfile } from "@/types/user";

export default function ProfileClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const loadProfile = useCallback(async (currentUser: typeof user) => {
    if (authLoading) return;

    if (!currentUser) {
      setProfile(null);
      setLoading(false);
      router.replace("/login?returnTo=%2Fprofile");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextProfile: UserProfile = { user: currentUser };

      if (currentUser.role === "CUSTOMER") {
        nextProfile.customer = await getMyCustomerProfile();
      } else if (currentUser.role === "SELLER") {
        nextProfile.seller = await getMySellerProfile();
      }

      setProfile(nextProfile);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setUser(null);
        router.replace("/login?returnTo=%2Fprofile");
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError("Sua sessão não tem permissão para consultar este perfil.");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o perfil.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, router, setUser]);

  useEffect(() => {
    if (!authLoading) void loadProfile(userRef.current);
  }, [authLoading, loadProfile, user?.id, user?.role]);

  const displayedProfile = profile && user
    ? { ...profile, user }
    : null;

  if (authLoading || loading) {
    return (
      <main className="container py-12" aria-live="polite">
        Carregando perfil...
      </main>
    );
  }

  if (error) {
    return (
      <main className="container space-y-4 py-12">
        <p role="alert">{error}</p>
        <Button onClick={() => void loadProfile(user)}>Tentar novamente</Button>
      </main>
    );
  }

  if (!displayedProfile) {
    return (
      <main className="container py-12">
        Redirecionando para o login...
      </main>
    );
  }

  return (
    <main className="container py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Meu perfil</h1>
          <Button onClick={() => setEditing(true)}>
            <Edit className="mr-2 h-4 w-4" /> Editar perfil
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{displayedProfile.user.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> {displayedProfile.user.email}
            </CardDescription>
          </CardHeader>
        </Card>
        {displayedProfile.customer && (
          <Card>
            <CardHeader>
              <CardTitle>Perfil de cliente</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {displayedProfile.customer.phone || "Telefone não informado"}
            </CardContent>
          </Card>
        )}
        {displayedProfile.seller && (
          <Card>
            <CardHeader>
              <CardTitle>Perfil de vendedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                {displayedProfile.seller.storeName}
              </p>
              <p>
                {displayedProfile.seller.description || "Sem descrição"}
              </p>
              <p className="text-sm text-muted-foreground">
                A reputação é calculada a partir das avaliações.
              </p>
            </CardContent>
          </Card>
        )}
        <p className="text-sm text-muted-foreground">
          Membro desde {new Date(displayedProfile.user.createdAt).toLocaleDateString()}
        </p>
      </div>
      <ProfileFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        userProfile={displayedProfile}
        onProfileUpdate={() => void loadProfile(user)}
      />
    </main>
  );
}
