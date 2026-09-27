"use client";

import { useState } from "react";
import { useCustomerAddresses } from "@/hooks/useCustomerAddresses";
import type {
  CustomerAddressDto,
  CustomerAddressInput,
} from "@/types/customerAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddressForm = {
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
  isDefault: boolean;
};

const EMPTY_FORM: AddressForm = {
  recipientName: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  phone: "",
  isDefault: false,
};

function formForAddress(address: CustomerAddressDto): AddressForm {
  return {
    recipientName: address.recipientName,
    postalCode: address.postalCode,
    street: address.street,
    number: address.number,
    complement: address.complement ?? "",
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    phone: address.phone ?? "",
    isDefault: address.isDefault,
  };
}

export function CustomerAddressesManager() {
  const addressState = useCustomerAddresses(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  function updateField<K extends keyof AddressForm>(
    field: K,
    value: AddressForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function beginEdit(address: CustomerAddressDto) {
    setEditingId(address.id);
    setForm(formForAddress(address));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submitAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CustomerAddressInput = {
      recipientName: form.recipientName,
      postalCode: form.postalCode,
      street: form.street,
      number: form.number,
      complement: form.complement || null,
      neighborhood: form.neighborhood,
      city: form.city,
      state: form.state,
      countryCode: "BR",
      phone: form.phone || null,
      ...(editingId ? {} : { isDefault: form.isDefault }),
    };

    const succeeded = editingId
      ? await addressState.update(editingId, payload)
      : await addressState.create(payload);

    if (succeeded) resetForm();
  }

  async function deactivate(address: CustomerAddressDto) {
    const confirmed = window.confirm(
      `Desativar o endereço de ${address.recipientName}?`,
    );
    if (confirmed) await addressState.deactivate(address.id);
  }

  const pagination = addressState.collection?.pagination;

  return (
    <section className="space-y-6" aria-labelledby="customer-addresses-title">
      <div>
        <h2 id="customer-addresses-title" className="text-2xl font-semibold">
          Meus endereços
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Endereços estruturados da conta. O perfil do customer contém somente telefone.
        </p>
      </div>

      {addressState.error && (
        <p className="rounded-md border border-destructive p-3 text-sm text-destructive" role="alert">
          {addressState.error}
        </p>
      )}

      <form className="grid gap-4 rounded-lg border p-5 sm:grid-cols-2" onSubmit={submitAddress}>
        <h3 className="sm:col-span-2 text-lg font-medium">
          {editingId ? "Editar endereço" : "Adicionar endereço"}
        </h3>
        <AddressField label="Nome do destinatário" value={form.recipientName} onChange={(value) => updateField("recipientName", value)} required />
        <AddressField label="CEP" value={form.postalCode} onChange={(value) => updateField("postalCode", value)} placeholder="00000-000" required />
        <AddressField label="Rua" value={form.street} onChange={(value) => updateField("street", value)} required />
        <AddressField label="Número" value={form.number} onChange={(value) => updateField("number", value)} required />
        <AddressField label="Complemento" value={form.complement} onChange={(value) => updateField("complement", value)} />
        <AddressField label="Bairro" value={form.neighborhood} onChange={(value) => updateField("neighborhood", value)} required />
        <AddressField label="Cidade" value={form.city} onChange={(value) => updateField("city", value)} required />
        <AddressField label="Estado (UF)" value={form.state} onChange={(value) => updateField("state", value)} maxLength={2} required />
        <AddressField label="Telefone (opcional)" value={form.phone} onChange={(value) => updateField("phone", value)} />
        {!editingId && (
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => updateField("isDefault", event.target.checked)}
            />
            Definir como endereço padrão
          </label>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={addressState.mutating}>
            {editingId ? "Salvar endereço" : "Adicionar endereço"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancelar edição
            </Button>
          )}
        </div>
      </form>

      {addressState.loading ? (
        <p role="status">Carregando endereços…</p>
      ) : addressState.addresses.length === 0 ? (
        <p className="rounded-lg border p-5 text-sm text-muted-foreground">
          Você ainda não cadastrou endereços.
        </p>
      ) : (
        <div className="space-y-3">
          {addressState.addresses.map((address) => (
            <article key={address.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">
                    {address.recipientName}
                    {address.isDefault && (
                      <span className="ml-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                        Padrão
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {address.street}, {address.number}
                    {address.complement ? `, ${address.complement}` : ""} · {address.neighborhood}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.city} - {address.state}, {address.postalCode} · {address.countryCode}
                  </p>
                  {address.phone && (
                    <p className="text-sm text-muted-foreground">{address.phone}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!address.isDefault && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={addressState.mutating}
                      onClick={() => void addressState.setDefault(address.id)}
                    >
                      Tornar padrão
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => beginEdit(address)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={addressState.mutating}
                    onClick={() => void deactivate(address)}
                  >
                    Desativar
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                disabled={addressState.page <= 1}
                onClick={() => addressState.setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <span>Página {pagination.page} de {pagination.totalPages}</span>
              <Button
                type="button"
                variant="outline"
                disabled={addressState.page >= pagination.totalPages}
                onClick={() => addressState.setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type AddressFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
};

function AddressField({
  label,
  value,
  onChange,
  required = false,
  maxLength,
  placeholder,
}: AddressFieldProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
      />
    </div>
  );
}
