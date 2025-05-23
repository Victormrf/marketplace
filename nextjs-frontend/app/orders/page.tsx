"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Package,
  Calendar,
  DollarSign,
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

// Enums e tipos baseados no modelo fornecido
export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    name: string;
    image?: string;
  };
};

export type Order = {
  id: string;
  customerId: string;
  totalPrice: number;
  status: OrderStatus;
  createdAt: Date;
  orderItems: OrderItem[];
};

// Dados de exemplo
const MOCK_ORDERS: Order[] = [
  {
    id: "order-001",
    customerId: "customer-1",
    totalPrice: 5849.88,
    status: OrderStatus.DELIVERED,
    createdAt: new Date("2024-01-15T10:30:00"),
    orderItems: [
      {
        id: "item-001",
        orderId: "order-001",
        productId: "prod-001",
        quantity: 1,
        unitPrice: 4999.99,
        product: {
          id: "prod-001",
          name: "Smartphone Galaxy S23",
          image: "/placeholder.svg",
        },
      },
      {
        id: "item-002",
        orderId: "order-001",
        productId: "prod-002",
        quantity: 1,
        unitPrice: 849.89,
        product: {
          id: "prod-002",
          name: "Capinha Protetora",
          image: "/placeholder.svg",
        },
      },
    ],
  },
  {
    id: "order-002",
    customerId: "customer-1",
    totalPrice: 5499.99,
    status: OrderStatus.SHIPPED,
    createdAt: new Date("2024-01-20T14:15:00"),
    orderItems: [
      {
        id: "item-003",
        orderId: "order-002",
        productId: "prod-003",
        quantity: 1,
        unitPrice: 5499.99,
        product: {
          id: "prod-003",
          name: "Notebook Dell Inspiron",
          image: "/placeholder.svg",
        },
      },
    ],
  },
  {
    id: "order-003",
    customerId: "customer-1",
    totalPrice: 359.8,
    status: OrderStatus.PROCESSING,
    createdAt: new Date("2024-01-22T09:45:00"),
    orderItems: [
      {
        id: "item-004",
        orderId: "order-003",
        productId: "prod-004",
        quantity: 2,
        unitPrice: 59.9,
        product: {
          id: "prod-004",
          name: "Camiseta Básica",
          image: "/placeholder.svg",
        },
      },
      {
        id: "item-005",
        orderId: "order-003",
        productId: "prod-005",
        quantity: 1,
        unitPrice: 240.0,
        product: {
          id: "prod-005",
          name: "Calça Jeans",
          image: "/placeholder.svg",
        },
      },
    ],
  },
  {
    id: "order-004",
    customerId: "customer-1",
    totalPrice: 649.8,
    status: OrderStatus.PAID,
    createdAt: new Date("2024-01-23T16:20:00"),
    orderItems: [
      {
        id: "item-006",
        orderId: "order-004",
        productId: "prod-006",
        quantity: 1,
        unitPrice: 299.9,
        product: {
          id: "prod-006",
          name: "Tênis Esportivo",
          image: "/placeholder.svg",
        },
      },
      {
        id: "item-007",
        orderId: "order-004",
        productId: "prod-007",
        quantity: 1,
        unitPrice: 349.9,
        product: {
          id: "prod-007",
          name: "Fone de Ouvido Bluetooth",
          image: "/placeholder.svg",
        },
      },
    ],
  },
  {
    id: "order-005",
    customerId: "customer-1",
    totalPrice: 149.9,
    status: OrderStatus.PENDING,
    createdAt: new Date("2024-01-24T11:10:00"),
    orderItems: [
      {
        id: "item-008",
        orderId: "order-005",
        productId: "prod-008",
        quantity: 1,
        unitPrice: 149.9,
        product: {
          id: "prod-008",
          name: "Livro - O Senhor dos Anéis",
          image: "/placeholder.svg",
        },
      },
    ],
  },
  {
    id: "order-006",
    customerId: "customer-1",
    totalPrice: 299.9,
    status: OrderStatus.CANCELLED,
    createdAt: new Date("2024-01-18T13:30:00"),
    orderItems: [
      {
        id: "item-009",
        orderId: "order-006",
        productId: "prod-009",
        quantity: 1,
        unitPrice: 299.9,
        product: {
          id: "prod-009",
          name: "Relógio Smartwatch",
          image: "/placeholder.svg",
        },
      },
    ],
  },
];

// Configuração de status para exibição
const STATUS_CONFIG = {
  [OrderStatus.PENDING]: {
    label: "Pending",
    variant: "secondary" as const,
    color: "bg-gray-200",
  },
  [OrderStatus.PAID]: {
    label: "Paid",
    variant: "default" as const,
    color: "bg-blue-400",
  },
  [OrderStatus.PROCESSING]: {
    label: "Processing",
    variant: "default" as const,
    color: "bg-orange-400",
  },
  [OrderStatus.SHIPPED]: {
    label: "Sent",
    variant: "default" as const,
    color: "bg-purple-500",
  },
  [OrderStatus.DELIVERED]: {
    label: "Delivered",
    variant: "default" as const,
    color: "bg-green-400",
  },
  [OrderStatus.CANCELLED]: {
    label: "Cancelled",
    variant: "destructive" as const,
    color: "bg-red-500",
  },
  [OrderStatus.REFUNDED]: {
    label: "Reimbursed",
    variant: "outline" as const,
    color: "bg-orange-500",
  },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Carregar e ordenar orders por data decrescente
  useEffect(() => {
    const sortedOrders = [...MOCK_ORDERS].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setOrders(sortedOrders);
    setFilteredOrders(sortedOrders);
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
          <h1 className="text-3xl font-bold">Meus Pedidos</h1>

          {/* Barra de busca e filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por produtos nos pedidos..."
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
                  <SelectItem value="all">Todos os status</SelectItem>
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
                  ? "Nenhum pedido encontrado com os filtros aplicados."
                  : "Você ainda não fez nenhum pedido."}
              </p>
              {(searchQuery || statusFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Limpar Filtros
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
                        <h3 className="font-semibold">Pedido #{order.id}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={STATUS_CONFIG[order.status].variant}
                        className={`whitespace-nowrap ${
                          STATUS_CONFIG[order.status].color
                        }`}
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
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-semibold">
                        {formatCurrency(order.totalPrice)}
                      </span>
                    </div>

                    {/* Lista de produtos */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Produtos:
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
                                  Quantidade: {item.quantity} ×{" "}
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
