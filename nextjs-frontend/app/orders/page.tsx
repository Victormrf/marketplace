"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Package,
  Calendar,
  CircleDollarSign,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Order, OrderStatus } from "@/types/orders";

// Configuração de status para exibição
const STATUS_CONFIG = {
  [OrderStatus.PENDING]: {
    label: "Pending",
    variant: "secondary" as const,
    color: "h-full",
  },
  [OrderStatus.PAID]: {
    label: "Paid",
    variant: "info" as const,
    color: "h-full",
  },
  [OrderStatus.PROCESSING]: {
    label: "Processing",
    variant: "warning" as const,
    color: "h-full",
  },
  [OrderStatus.SHIPPED]: {
    label: "Sent",
    variant: "purple" as const,
    color: "h-full",
  },
  [OrderStatus.DELIVERED]: {
    label: "Delivered",
    variant: "success" as const,
    color: "h-full",
  },
  [OrderStatus.CANCELLED]: {
    label: "Cancelled",
    variant: "destructive" as const,
    color: "h-full",
  },
  [OrderStatus.REFUNDED]: {
    label: "Reimbursed",
    variant: "warning" as const,
    color: "h-full",
  },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Carregar e ordenar orders por data decrescente
  useEffect(() => {
    async function fetchOrders() {
      try {
        // 1. Return customer
        const customerRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/customers/`,
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (!customerRes.ok) throw new Error("Error returning customer");
        const customerData = await customerRes.json();

        // 2. Return orders from customer
        const ordersRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/orders/customer/${customerData.profile.id}`,
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (!ordersRes.ok) throw new Error("Error returning orders");

        const ordersData = await ordersRes.json();

        const sortedOrders = [...ordersData.orders].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(sortedOrders);
        setFilteredOrders(sortedOrders);
      } catch (error) {
        console.error("Error fetchin orders:", error);
      }
    }
    fetchOrders();
  }, []);

  // Filtrar orders quando a busca ou status mudar
  useEffect(() => {
    let filtered = [...orders];

    // Filtrar por busca nos produtos dos order items
    if (searchQuery) {
      filtered = filtered.filter((order) =>
        order.orderItems.some((item) =>
          item.product.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Filtrar por status
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, orders]);

  // Formatar data para exibição
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">My orders</h1>

          {/* Barra de busca e filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search for products in your orders..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Lista de pedidos */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                {searchQuery || statusFilter !== "all"
                  ? // ? "Nenhum pedido encontrado com os filtros aplicados."
                    "No order found based on applied filters."
                  : "You haven't made any order yet."}
              </p>
              {(searchQuery || statusFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold">Order #{order.id}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={STATUS_CONFIG[order.status].variant}
                        className="py-2 px-4 h-9 flex items-center"
                      >
                        {STATUS_CONFIG[order.status].label}
                      </Badge>
                      <Link href={`/orders/${order.id}/tracking`}>
                        <Button
                          size="sm"
                          className="inline-flex items-center gap-2"
                        >
                          <Truck className="h-4 w-4" />
                          Track Order
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Valor total */}
                    <div className="flex items-center gap-2">
                      <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-semibold">
                        {formatCurrency(order.totalPrice)}
                      </span>
                    </div>

                    {/* Lista de produtos */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Products:
                      </h4>
                      <div className="grid gap-2">
                        {order.orderItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-background rounded border overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.product.image || "/placeholder.svg"}
                                  alt={item.product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {item.product.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Amount: {item.quantity} ×{" "}
                                  {formatCurrency(item.unitPrice)}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm font-medium">
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
