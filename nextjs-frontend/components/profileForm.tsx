"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { updateMyCustomerProfile } from "@/services/customer";
import { updateMySellerProfile } from "@/services/seller";
import { updateCurrentUser } from "@/services/user";
import type { UserProfile } from "@/types/user";

export default function EditProfilePage({
  userProfile,
  onSuccess,
}: {
  userProfile: UserProfile;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(userProfile.user.name);
  const [email, setEmail] = useState(userProfile.user.email);
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(userProfile.customer?.phone ?? "");
  const [storeName, setStoreName] = useState(userProfile.seller?.storeName ?? "");
  const [description, setDescription] = useState(userProfile.seller?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userChanges: { name?: string; email?: string; password?: string } = {};
      if (name !== userProfile.user.name) userChanges.name = name;
      if (email !== userProfile.user.email) userChanges.email = email;
      if (password) userChanges.password = password;
      if (Object.keys(userChanges).length > 0) {
        const updatedUser = await updateCurrentUser(userChanges);
        setUser(updatedUser);
      }

      if (userProfile.customer && phone !== (userProfile.customer.phone ?? "")) {
        await updateMyCustomerProfile({ phone: phone || null });
      }

      if (userProfile.seller) {
        const sellerChanges: { storeName?: string; description?: string } = {};
        if (storeName !== userProfile.seller.storeName) sellerChanges.storeName = storeName;
        if (description !== (userProfile.seller.description ?? "")) {
          sellerChanges.description = description;
        }
        if (Object.keys(sellerChanges).length > 0) {
          await updateMySellerProfile(sellerChanges);
        }
      }

      onSuccess();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError("Sua sessão não tem permissão para alterar este perfil.");
      } else {
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar o perfil.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome</Label>
        <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-password">Nova senha (opcional)</Label>
        <Input id="profile-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {userProfile.customer && (
        <div className="space-y-2">
          <Label htmlFor="profile-phone">Telefone</Label>
          <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <p className="text-xs text-muted-foreground">Endereços são gerenciados separadamente e não fazem parte do CustomerProfile.</p>
        </div>
      )}
      {userProfile.seller && (
        <>
          <div className="space-y-2">
            <Label htmlFor="profile-store-name">Nome da loja</Label>
            <Input id="profile-store-name" value={storeName} onChange={(event) => setStoreName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-store-description">Descrição da loja</Label>
            <Textarea id="profile-store-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </div>
          <p className="text-xs text-muted-foreground">Upload de logo fica fora desta etapa; o contrato de perfil aceita uma URL.</p>
        </>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
