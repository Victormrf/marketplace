"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/context/authContext";
import { useSellerDashboard } from "@/hooks/useSellerDashboard";
import type { DashboardRange, SellerOrderStatus } from "@/types/dashboard";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const statuses: SellerOrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];
const chartColors = ["#1f283c", "#7a7e8a", "#48556c", "#a1a1a1", "#64748b"];

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function initialRange(): DashboardRange {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatPeriod(period: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${period}T00:00:00.000Z`));
  }
  return period;
}

export default function SellerDashboard() {
  const { user, loading: sessionLoading } = useAuth();
  const [range, setRange] = useState<DashboardRange>(() => initialRange());
  const stableRange = useMemo(
    () => ({ from: range.from, to: range.to }),
    [range.from, range.to],
  );
  const dashboard = useSellerDashboard(
    stableRange,
    !sessionLoading && user?.role === "SELLER",
  );

  if (sessionLoading) {
    return <p className="p-8">Verificando sua sessão…</p>;
  }

  if (!user) {
    return (
      <section className="p-8" role="alert">
        Sua sessão expirou ou não está ativa. Entre como seller para acessar o dashboard.
      </section>
    );
  }

  if (user.role !== "SELLER") {
    return (
      <section className="p-8" role="alert">
        Você não tem permissão para acessar o dashboard do seller.
      </section>
    );
  }

  const { data } = dashboard;
  const canGoPrevious = dashboard.page > 1;
  const canGoNext = dashboard.page < data.orders.pagination.totalPages;

  return (
    <main className="min-h-screen space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard da loja</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            De
            <input
              aria-label="Data inicial"
              className="h-9 rounded-md border px-2"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(event) => {
                dashboard.setPage(1);
                setRange((current) => ({ ...current, from: event.target.value }));
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Até
            <input
              aria-label="Data final"
              className="h-9 rounded-md border px-2"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(event) => {
                dashboard.setPage(1);
                setRange((current) => ({ ...current, to: event.target.value }));
              }}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => void dashboard.refresh()}
            disabled={dashboard.loading}
          >
            Atualizar
          </Button>
        </div>
      </header>

      {dashboard.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
          <p>
            {dashboard.errorStatus === 401
              ? "Sua sessão não está autenticada. Entre novamente."
              : dashboard.errorStatus === 403
                ? "Sua conta não tem permissão de seller para consultar estes dados."
                : dashboard.errorStatus === 400
                  ? `O período ou filtro informado não é aceito pelo backend. ${dashboard.error}`
                  : dashboard.error}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void dashboard.refresh()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {dashboard.loading && <p role="status">Carregando métricas…</p>}

      {!dashboard.error && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Receita bruta reconhecida"
              value={formatCurrency(data.summary.grossRevenueInCents, data.summary.currency)}
              hint="SellerOrders entregues no período; não desconta refunds."
            />
            <MetricCard
              title="SellerOrders entregues"
              value={String(data.summary.deliveredSellerOrders)}
              hint="Contagem por data de conclusão."
            />
            <MetricCard
              title="Itens vendidos"
              value={String(data.summary.itemsSold)}
              hint="Soma das quantidades em pedidos entregues."
            />
            <MetricCard
              title="Ticket médio"
              value={formatCurrency(data.summary.averageTicketInCents, data.summary.currency)}
              hint="Receita bruta dividida pelas SellerOrders entregues."
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">Receita por período</h2>
                  <div className="flex gap-2">
                    <Button
                      variant={dashboard.interval === "day" ? "default" : "outline"}
                      onClick={() => dashboard.setInterval("day")}
                    >
                      Diário
                    </Button>
                    <Button
                      variant={dashboard.interval === "month" ? "default" : "outline"}
                      onClick={() => dashboard.setInterval("month")}
                    >
                      Mensal
                    </Button>
                  </div>
                </div>
                <ChartEmpty isEmpty={data.timeseries.length === 0}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.timeseries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tickFormatter={formatPeriod} />
                      <YAxis tickFormatter={(value: number) => formatCurrency(value)} />
                      <Tooltip
                        labelFormatter={formatPeriod}
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Line dataKey="grossRevenueInCents" name="Receita bruta" stroke="#1f283c" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartEmpty>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold">Produtos mais vendidos</h2>
                <ChartEmpty isEmpty={data.topProducts.length === 0}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.topProducts} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="productName" width={150} />
                      <Tooltip />
                      <Bar dataKey="itemsSold" name="Itens vendidos" fill="#1f283c" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartEmpty>
                {data.topProducts.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm">
                    {data.topProducts.map((product) => (
                      <li
                        className="flex justify-between gap-3"
                        key={product.productId}
                      >
                        <span>{product.productName} · {product.itemsSold} itens</span>
                        <span>{formatCurrency(product.grossRevenueInCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold">Receita por categoria</h2>
                <ChartEmpty isEmpty={data.categories.length === 0}>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={data.categories}
                        dataKey="grossRevenueInCents"
                        nameKey="category"
                        outerRadius={90}
                        label
                      >
                        {data.categories.map((item, index) => (
                          <Cell key={item.category} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartEmpty>
                {data.categories.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm">
                    {data.categories.map((category) => (
                      <li
                        className="flex justify-between gap-3"
                        key={category.category}
                      >
                        <span>{category.category} · {category.itemsSold} itens</span>
                        <span>{formatCurrency(category.grossRevenueInCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold">SellerOrders por status</h2>
                <ChartEmpty isEmpty={data.statuses.every((item) => item.count === 0)}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.statuses}>
                      <XAxis dataKey="status" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="SellerOrders" fill="#48556c" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartEmpty>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold">Novos customers por mês</h2>
                <ChartEmpty isEmpty={data.newCustomers.length === 0}>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data.newCustomers}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area dataKey="newCustomers" name="Novos customers" stroke="#1f283c" fill="#94a3b8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartEmpty>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-2 font-semibold">Reputação do seller</h2>
                <p className="text-3xl font-bold">
                  {data.ratings.averageRating === null
                    ? "Sem avaliações"
                    : `${data.ratings.averageRating.toFixed(1)} / 5`}
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  {data.ratings.totalReviews} avaliações direcionadas à loja.
                </p>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart
                    data={Object.entries(data.ratings.distribution).map(([rating, count]) => ({ rating, count }))}
                  >
                    <XAxis dataKey="rating" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Avaliações" fill="#1f283c" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">SellerOrders criadas</h2>
                  <p className="text-sm text-muted-foreground">
                    Filtradas por createdAt; receita reconhecida usa completedAt.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  Status
                  <select
                    className="h-9 rounded-md border bg-background px-2"
                    value={dashboard.status}
                    onChange={(event) => {
                      dashboard.setStatus(event.target.value as SellerOrderStatus | "");
                      dashboard.setPage(1);
                    }}
                  >
                    <option value="">Todos</option>
                    {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              {data.orders.data.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">
                  Nenhuma SellerOrder neste período/filtro.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">ID</th>
                        <th className="p-2">Criada</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Valor do pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.data.map((order) => (
                        <tr className="border-b" key={order.id}>
                          <td className="p-2 font-mono">{order.id.slice(0, 8)}</td>
                          <td className="p-2">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</td>
                          <td className="p-2">{order.status}</td>
                          <td className="p-2">{formatCurrency(order.totalInCents, order.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {data.orders.pagination.total} resultados · página {dashboard.page} de{" "}
                  {data.orders.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!canGoPrevious || dashboard.loading}
                    onClick={() => dashboard.setPage((value) => value - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canGoNext || dashboard.loading}
                    onClick={() => dashboard.setPage((value) => value + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function MetricCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ isEmpty, children }: { isEmpty: boolean; children: React.ReactNode }) {
  if (isEmpty) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Sem dados neste período.
      </div>
    );
  }
  return <>{children}</>;
}
