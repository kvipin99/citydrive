"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";

/**
 * A hydration-safe real-time clock component for the dashboard.
 * Displays the current date, day of the week, and time (HH:MM:SS AM/PM).
 */
export function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial date on mount
    setNow(new Date());
    
    // Update every second
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Prevent hydration mismatch by showing a skeleton during server-side render
  if (!now) {
    return (
      <div className="h-10 w-48 animate-pulse bg-muted/50 rounded-xl border border-transparent" />
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 text-sm bg-background/50 backdrop-blur-sm px-4 py-2 rounded-xl border shadow-sm w-fit animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-muted-foreground font-medium">
        <Calendar className="h-4 w-4 text-primary" />
        <span className="whitespace-nowrap">{format(now, "EEEE, MMMM do, yyyy")}</span>
      </div>
      <div className="flex items-center gap-2 text-foreground font-bold border-t sm:border-t-0 sm:border-l sm:pl-6 pt-1 sm:pt-0">
        <Clock className="h-4 w-4 text-primary" />
        <span className="font-mono tabular-nums tracking-tight">
          {format(now, "hh:mm:ss a")}
        </span>
      </div>
    </div>
  );
}
