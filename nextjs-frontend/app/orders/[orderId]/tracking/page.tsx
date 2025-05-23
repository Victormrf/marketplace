"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Forklift,
  PackageOpen,
  Map,
  Truck,
  CheckCircle,
  MapPinCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TRACKING_STEPS = [
  {
    status: "SEPARATED",
    label: "In stock separation",
    icon: Forklift,
    date: "2024-05-20T10:30:00Z",
  },
  {
    status: "PROCESSING",
    label: "Preparing order",
    icon: PackageOpen,
    date: "2024-05-20T14:45:00Z",
  },
  {
    status: "SHIPPED",
    label: "Order sent",
    icon: Map,
    date: "2024-05-21T09:15:00Z",
  },
  {
    status: "COLLECTED",
    label: "Collected by transport company",
    icon: Truck,
    date: "2024-05-21T11:30:00Z",
  },
  {
    status: "ARRIVED_AT_CENTER",
    label: "Arrived at distribution center",
    icon: MapPinCheck,
    date: "2024-05-22T08:00:00Z",
  },
  {
    status: "DELIVERED",
    label: "Order delivered",
    icon: CheckCircle,
    date: "2024-05-22T14:20:00Z",
  },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function TrackOrderPage() {
  const params = useParams();
  const orderId = params.orderId as string;

  // In a real scenario, you would fetch the order data from the API
  const currentStatus = "SHIPPED"; // Simulation
  const currentStepIndex = TRACKING_STEPS.findIndex(
    (step) => step.status === currentStatus
  );
  const progress = ((currentStepIndex + 1) / TRACKING_STEPS.length) * 100;

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Track Order</h1>
            <p className="text-muted-foreground">Order #{orderId}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Progress</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {currentStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-8" />

            <div className="space-y-8">
              {TRACKING_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isLast = index === TRACKING_STEPS.length - 1;

                return (
                  <div key={step.status} className="relative">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div
                          className={`
                            flex items-center justify-center w-10 h-10 rounded-full border-2
                            ${
                              isCompleted
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground text-muted-foreground"
                            }
                            ${
                              isCurrent
                                ? "ring-2 ring-primary ring-offset-2"
                                : ""
                            }
                          `}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        {!isLast && (
                          <div
                            className={`
                              absolute left-1/2 h-full border-l-2 -translate-x-1/2 top-10
                              ${isCompleted ? "border-primary" : "border-muted"}
                            `}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between">
                          <p
                            className={`font-medium ${
                              isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                          <span
                            className={`text-sm ${
                              isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatDate(step.date)}
                          </span>
                        </div>
                        {isCurrent && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Current status
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
