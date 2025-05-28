import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border-primary hover:bg-primary/20",
        secondary:
          "bg-gray-100 text-gray-600 border-gray-600 hover:bg-gray-200",
        destructive: "bg-red-50 text-red-600 border-red-600 hover:bg-red-100",
        outline: "text-foreground",
        warning:
          "bg-yellow-50 text-yellow-600 border-yellow-600 hover:bg-yellow-100",
        success:
          "bg-green-50 text-green-600 border-green-600 hover:bg-green-100",
        info: "bg-blue-50 text-blue-600 border-blue-600 hover:bg-blue-100",
        purple:
          "bg-purple-50 text-purple-600 border-purple-600 hover:bg-purple-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
