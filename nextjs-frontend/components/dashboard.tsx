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
import { useState } from "react";
import { Button } from "./ui/button";
import DashboardHeader from "./dashboardHeader";

const COLORS = ["#1f283c", "#cbd5e2", "#48556c", "#a1a1a1"];

const sales6Months = [
  { date: "December", revenue: 2000 },
  { date: "January", revenue: 1200 },
  { date: "February", revenue: 800 },
  { date: "March", revenue: 1000 },
  { date: "April", revenue: 1800 },
  { date: "May", revenue: 750 },
];

const sales15Days = [
  { date: "04/01", revenue: 150 },
  { date: "04/02", revenue: 120 },
  { date: "04/03", revenue: 90 },
  { date: "04/04", revenue: 110 },
  { date: "04/05", revenue: 130 },
  { date: "04/06", revenue: 100 },
  { date: "04/07", revenue: 160 },
  { date: "04/08", revenue: 135 },
  { date: "04/09", revenue: 90 },
  { date: "04/10", revenue: 110 },
  { date: "04/11", revenue: 80 },
  { date: "04/12", revenue: 70 },
  { date: "04/13", revenue: 85 },
  { date: "04/14", revenue: 100 },
  { date: "04/15", revenue: 80 },
];

const topProducts = [
  { name: "Wireless Mouse", quantity: 45 },
  { name: "Laptop Stand", quantity: 32 },
  { name: "Mechanical Keyboard", quantity: 28 },
  { name: "Smartwatch", quantity: 25 },
  { name: "Mouse Pad", quantity: 21 },
];

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
  const salesData = view === "6months" ? sales6Months : sales15Days;

  return (
    <>
      <DashboardHeader storeName="Nome da Loja" userEmail="email@exemplo.com" />
      <div className="p-6 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p>Total Sales</p>
              <p className="text-2xl font-bold">R$ 12.300</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p>Products Listed</p>
              <p className="text-2xl font-bold">23</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p>Orders</p>
              <p className="text-2xl font-bold">87</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p>Avg. Rating</p>
              <p className="text-2xl font-bold">4.6 / 5</p>
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
                  Sales ({view === "6months" ? "Last 6 Months" : "Last 30 Days"}
                  )
                </h2>
                <div className="space-x-2">
                  <Button
                    variant={view === "6months" ? "default" : "outline"}
                    onClick={() => setView("6months")}
                  >
                    6 Months
                  </Button>
                  <Button
                    variant={view === "30days" ? "default" : "outline"}
                    onClick={() => setView("30days")}
                  >
                    30 Days
                  </Button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={salesData}>
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
                <BarChart data={topProducts} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={180} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#1f283c" />
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
  );
}
