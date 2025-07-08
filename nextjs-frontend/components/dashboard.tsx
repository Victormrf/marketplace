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
import { Store } from "@/types/store";
import { Product } from "@/types/product";

export interface OrderData {
  id: string;
  customerId: string;
  totalPrice: number;
  createdAt: Date;
}

const COLORS = ["#1f283c", "#7a7e8a", "#48556c", "#a1a1a1"];

export default function SellerDashboard() {
  const [view, setView] = useState<"6months" | "30days">("6months");
  const [store, setStore] = useState<Store | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "sales" | "customers"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [storeOrders, setStoreOrders] = useState<OrderData[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [revenuePerDate, setRevenuePerDate] = useState<
    { date: string; revenue: number }[]
  >([]);
  const [revenuePerCategory, setRevenuePerCategory] = useState<
    { category: string; totalSales: number }[]
  >([]);
  const [bestSellingProducts, setBestSellingProducts] = useState<Product[]>([]);
  const [ordersPerStatus, setOrdersPerStatus] = useState<
    { status: string; count: number }[]
  >([]);
  const [newCustomers, setNewCustomers] = useState<
    { month: string; newCustomers: number }[]
  >([]);
  const [ratingDistribution, setRatingDistribution] = useState<
    { rating: number; count: number }[]
  >([]);

  const fetchRevenueData = async (
    storeId: string,
    dateFormat: "6months" | "30days"
  ) => {
    const endpoint =
      dateFormat === "6months"
        ? `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/lastSixMonthsSalesStats/${storeId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/lastThirtyDaysSalesStats/${storeId}`;

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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sellers/`, {
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
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/salesStats/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const salesData = await salesRes.json();
            setTotalSales(salesData.totalSales);

            // Total products
            const productsRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/products/seller/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const productsData = await productsRes.json();
            setStoreProducts(productsData.products);

            // Total orders
            const ordersRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/orders/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const ordersData = await ordersRes.json();
            setStoreOrders(ordersData);

            // Average store rating
            const reviewRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/review/seller/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const reviewData = await reviewRes.json();
            setAvgRating(reviewData.averageRating);

            // Initial revenue data fetch
            await fetchRevenueData(storeData.id, "6months");

            // Top selling products
            const bestSellingProductsRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/bestSellingProducts/${storeData.id}`,
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

            // Revenue per category
            const revenuePerCategoryRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/salesByCategory/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const revenuePerCategoryData = await revenuePerCategoryRes.json();
            setRevenuePerCategory(revenuePerCategoryData);

            // Orders per status
            const ordersPerStatusRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/ordersByStatus/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const ordersPerStatusData = await ordersPerStatusRes.json();
            setOrdersPerStatus(ordersPerStatusData);

            // New customers per month
            const newCustomersPerMonthRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/newCustomersByMonth/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const newCustomersPerMonthData =
              await newCustomersPerMonthRes.json();
            setNewCustomers(newCustomersPerMonthData);

            // Rating distribution
            const ratingDistributionRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/dashboard/sellers/ratingDistribution/${storeData.id}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
            const ratingDistributionData = await ratingDistributionRes.json();
            setRatingDistribution(ratingDistributionData);
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
        <div className="min-h-screen">
          <div className="sticky top-0 z-10 border-b">
            <DashboardHeader
              storeLogo={store?.logo ? store.logo : "/store-placeholder.png"}
              storeName={store?.storeName ? store.storeName : "Nome da Loja"}
              userEmail={
                store?.user?.email ? store.user.email : "email@exemplo.com"
              }
              selectedTab={selectedTab}
              onTabChange={(tab) => setSelectedTab(tab)}
            />
          </div>
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p>Total Sales</p>
                  <p className="text-2xl font-bold">
                    {totalSales ? `$ ${totalSales}` : "$ 0,00"}
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
                    {avgRating ? `${avgRating} / 5` : "-.- / 5"}
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
                  {bestSellingProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={bestSellingProducts} layout="vertical">
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={180} />
                        <Tooltip />
                        <Bar dataKey="totalSold" fill="#1f283c" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center">
                      <p className="text-muted-foreground text-center">
                        No products have been sold yet.
                        <br />
                        Your top selling products will appear here.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Revenue by Category
                  </h2>
                  {revenuePerCategory.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={revenuePerCategory}
                          dataKey="totalSales"
                          nameKey="category"
                          outerRadius={80}
                          label
                        >
                          {revenuePerCategory.map((entry, index) => (
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
                  ) : (
                    <div className="h-[250px] flex items-center justify-center">
                      <p className="text-muted-foreground text-center">
                        No products have been sold yet.
                        <br />
                        Your revenue per category will appear here.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Recent Orders by Status (Last 14 days)
                  </h2>
                  {ordersPerStatus.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={ordersPerStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {ordersPerStatus.map((entry, index) => (
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
                  ) : (
                    <div className="h-[250px] flex items-center justify-center">
                      <p className="text-muted-foreground text-center">
                        No orders have been made recently.
                        <br />
                        Your order per status information will appear here.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    New customers per Month
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={newCustomers}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="newCustomers"
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
                      <XAxis dataKey="rating" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1f283c" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
