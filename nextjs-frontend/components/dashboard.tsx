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
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

const COLORS = ["#1f283c", "#cbd5e2", "#48556c", "#a1a1a1"];

const salesByDate = [
  { date: "December", revenue: 2000 },
  { date: "January", revenue: 1200 },
  { date: "February", revenue: 800 },
  { date: "March", revenue: 1000 },
  { date: "April", revenue: 1800 },
  { date: "May", revenue: 750 },
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

export default function SellerDashboard() {
  return (
    <div className="p-6 space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-2">
              Sales (Last 6 Months)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesByDate}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1f283c"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-2">Top Selling Products</h2>
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

        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-2">Revenue by Category</h2>
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
            <h2 className="text-lg font-semibold mb-2">Rating Distribution</h2>
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
  );
}
