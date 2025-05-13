// dashboard
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import DashboardHeader from "./dashboardHeader";

export interface SellerDashboardProps {
  storeId: string;
}

export interface UserData {
  email: string;
}

export interface StoreData {
  id: string;
  storeName: string;
  logo?: string;
  description?: string;
  user: UserData;
}

export interface ProductData {
  id: string;
  sellerId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
  createdAt: Date;
  totalSold?: number;
}

export interface OrderData {
  id: string;
  customerId: string;
  totalPrice: number;
  createdAt: Date;
}

const COLORS = ["#1f283c", "#cbd5e2", "#48556c", "#a1a1a1"];

// const sales6Months = [
//   { date: "December", revenue: 2000 },
//   { date: "January", revenue: 1200 },
//   { date: "February", revenue: 800 },
//   { date: "March", revenue: 1000 },
//   { date: "April", revenue: 1800 },
//   { date: "May", revenue: 750 },
// ];

// const sales15Days = [
//   { date: "04/01", revenue: 150 },
//   { date: "04/02", revenue: 120 },
//   { date: "04/03", revenue: 90 },
//   { date: "04/04", revenue: 110 },
//   { date: "04/05", revenue: 130 },
//   { date: "04/06", revenue: 100 },
//   { date: "04/07", revenue: 160 },
//   { date: "04/08", revenue: 135 },
//   { date: "04/09", revenue: 90 },
//   { date: "04/10", revenue: 110 },
//   { date: "04/11", revenue: 80 },
//   { date: "04/12", revenue: 70 },
//   { date: "04/13", revenue: 85 },
//   { date: "04/14", revenue: 100 },
//   { date: "04/15", revenue: 80 },
// ];

const categoryRevenue = [
  { category: "Office", value: 4200 },
  { category: "Electronics", value: 3100 },
  { category: "Accessories", value: 2700 },
  { category: "Fitness", value: 1500 },
];

const ratingDistribution = [
  { stars: "5★", count: 40 },
  { stars: "4★", count: 15 },
  { stars: "3★", count: 5 },
  { stars: "2★", count: 2 },
];

const newCustomersByMonth = [
  { month: "January", count: 20 },
  { month: "February", count: 35 },
  { month: "March", count: 25 },
  { month: "April", count: 40 },
  { month: "May", count: 30 },
  { month: "June", count: 45 },
];

const ordersByStatus = [
  { status: "Pending", value: 24 },
  { status: "Shipped", value: 40 },
  { status: "Cancelled", value: 8 },
];

export default function SellerDashboard() {
  const [view, setView] = useState<"6months" | "30days">("6months");
  const [store, setStore] = useState<StoreData | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "sales" | "customers"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [storeProducts, setStoreProducts] = useState<ProductData[]>([]);
  const [storeOrders, setStoreOrders] = useState<OrderData[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [revenuePerDate, setRevenuePerDate] = useState<
    { date: string; revenue: number }[]
  >([]);
  const [bestSellingProducts, setBestSellingProducts] = useState<ProductData[]>(
    []
  );

  const fetchRevenueData = async (
    storeId: string,
    dateFormat: "6months" | "30days"
  ) => {
    const endpoint =
      dateFormat === "6months"
        ? `http://localhost:8000/dashboard/sellers/lastSixMonthsSalesStats/${storeId}`
        : `http://localhost:8000/dashboard/sellers/lastThirtyDaysSalesStats/${storeId}`;

    const response = await fetch(endpoint, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch revenue data: ${errorText}`);
    }

    const data = await response.json();
    setRevenuePerDate(data);
    setView(dateFormat);
  };

  useEffect(() => {
    async function fetchStoreData() {
      try {
        const res = await fetch("http://localhost:8000/sellers/", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch store data");
        }

        const data = await res.json();
        const storeData = data.profile ? data.profile : null;
        setStore(storeData);

        // Only fetch dashboard data if we have store data
        if (storeData?.id) {
          try {
            // Total sales
            const salesRes = await fetch(
              `http://localhost:8000/dashboard/sellers/salesStats/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (!salesRes.ok) {
              const errorText = await salesRes.text();
              throw new Error(`Failed to fetch dashboard data: ${errorText}`);
            }

            const salesData = await salesRes.json();
            setTotalSales(salesData.totalSales);

            // Total products
            const productsRes = await fetch(
              `http://localhost:8000/products/seller/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (!productsRes.ok) {
              const errorText = await productsRes.text();
              throw new Error(
                `Failed to fetch products from store: ${errorText}`
              );
            }

            const productsData = await productsRes.json();
            setStoreProducts(productsData.products);

            // Total orders
            const ordersRes = await fetch(
              `http://localhost:8000/dashboard/sellers/orders/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (!ordersRes.ok) {
              const errorText = await ordersRes.text();
              throw new Error(
                `Failed to fetch orders from store: ${errorText}`
              );
            }

            const ordersData = await ordersRes.json();
            setStoreOrders(ordersData);

            // Average store rating
            const reviewRes = await fetch(
              `http://localhost:8000/review/seller/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (!reviewRes.ok) {
              const errorText = await reviewRes.text();
              throw new Error(
                `Failed to fetch review from store: ${errorText}`
              );
            }

            const reviewData = await reviewRes.json();
            setAvgRating(reviewData.averageRating);

            // Initial revenue data fetch
            await fetchRevenueData(storeData.id, "6months");

            // Top selling products
            const bestSellingProductsRes = await fetch(
              `http://localhost:8000/dashboard/sellers/bestSellingProducts/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            const bestSellingProductsData = await bestSellingProductsRes.json();
            setBestSellingProducts(bestSellingProductsData);
          } catch (error) {
            console.error("Error retrieving dashboard data:", error);
          }
        }
      } catch (error) {
        console.error("Error retrieving store data:", error);
        setStore(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStoreData();
  }, []);

  const handleRevenuePerDateSwitch = async (
    dateFormat: "6months" | "30days"
  ) => {
    if (!store?.id) return;
    await fetchRevenueData(store.id, dateFormat);
  };

  return (
    <>
      {loading ? (
        <p>Fetching store data...</p>
      ) : (
        <>
          <DashboardHeader
            storeLogo={store?.logo ? store.logo : "/v-market-logo.png"}
            storeName={store?.storeName ? store.storeName : "Nome da Loja"}
            userEmail={
              store?.user?.email ? store.user.email : "email@exemplo.com"
            }
            selectedTab={selectedTab}
            onTabChange={(tab) => setSelectedTab(tab)}
          />
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p>Total Sales</p>
                  <p className="text-2xl font-bold">
                    {totalSales ? `$ ${totalSales}` : "$ 12.300"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p>Products Listed</p>
                  <p className="text-2xl font-bold">
                    {storeProducts.length ?? 23}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p>Orders</p>
                  <p className="text-2xl font-bold">
                    {storeOrders.length ?? 87}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p>Avg. Rating</p>
                  <p className="text-2xl font-bold">
                    {avgRating ? `${avgRating} / 5` : "4.6 / 5"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p>Avg. time to Purchase</p>
                  <p className="text-2xl font-bold">2d 4h</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold">
                      Sales (
                      {view === "6months" ? "Last 6 Months" : "Last 30 Days"})
                    </h2>
                    <div className="space-x-2">
                      <Button
                        variant={view === "6months" ? "default" : "outline"}
                        onClick={() => handleRevenuePerDateSwitch("6months")}
                      >
                        6 Months
                      </Button>
                      <Button
                        variant={view === "30days" ? "default" : "outline"}
                        onClick={() => handleRevenuePerDateSwitch("30days")}
                      >
                        30 Days
                      </Button>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={revenuePerDate}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#1f283c"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Top Selling Products
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={bestSellingProducts} layout="vertical">
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={180} />
                      <Tooltip />
                      <Bar dataKey="totalSold" fill="#1f283c" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Revenue by Category
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryRevenue}
                        dataKey="value"
                        nameKey="category"
                        outerRadius={80}
                      >
                        {categoryRevenue.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        verticalAlign="bottom"
                        align="right"
                        iconType="circle"
                        layout="horizontal"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Recent Orders by Status (Last 14 days)
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={ordersByStatus}
                        dataKey="value"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {ordersByStatus.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    New customers per Month
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={newCustomersByMonth}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#1f283c"
                        fill="#1f283c"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Rating Distribution
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={ratingDistribution}>
                      <XAxis dataKey="stars" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1f283c" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
