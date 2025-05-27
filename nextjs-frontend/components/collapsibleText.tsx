"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CollapsibleTextProps {
  text: string;
  maxLength?: number;
}

export function CollapsibleText({ text, maxLength = 100 }: CollapsibleTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > maxLength;

  const displayText = isExpanded ? text : text.slice(0, maxLength);

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500 dark:text-gray-400">
        {displayText}
        {!isExpanded && shouldTruncate && "..."}
      </p>
      {shouldTruncate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "See more"}
        </Button>
      )}
    </div>
  );
}