
"use client";

import * as React from "react";
import { format, parse, isValid, isAfter, isBefore } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateSegmentedInputProps {
  value: string; // ISO format YYYY-MM-DD
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A custom date input that allows Tabbing between Day, Month, and Year.
 */
export function DateSegmentedInput({
  value,
  onChange,
  disabled,
  className,
}: DateSegmentedInputProps) {
  const [day, setDay] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [year, setYear] = React.useState("");

  const dayRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  // Sync internal state with external value prop
  React.useEffect(() => {
    if (value && value.includes("-")) {
      const [y, m, d] = value.split("-");
      setYear(y || "");
      setMonth(m || "");
      setDay(d || "");
    } else {
      setYear("");
      setMonth("");
      setDay("");
    }
  }, [value]);

  const updateDate = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const dateStr = `${y}-${m}-${d}`;
      const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
      if (isValid(parsed)) {
        onChange(dateStr);
      }
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setDay(val);
    updateDate(val, month, year);
    if (val.length === 2 && parseInt(val) > 0 && parseInt(val) <= 31) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMonth(val);
    updateDate(day, val, year);
    if (val.length === 2 && parseInt(val) > 0 && parseInt(val) <= 12) {
      yearRef.current?.focus();
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setYear(val);
    updateDate(day, month, val);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const iso = format(date, "yyyy-MM-dd");
      onChange(iso);
    }
  };

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed bg-muted"
        )}
      >
        <input
          ref={dayRef}
          type="text"
          placeholder="DD"
          value={day}
          onChange={handleDayChange}
          disabled={disabled}
          className="w-6 bg-transparent outline-none text-center placeholder:text-muted-foreground/50"
          maxLength={2}
        />
        <span className="text-muted-foreground/30 mx-0.5">/</span>
        <input
          ref={monthRef}
          type="text"
          placeholder="MM"
          value={month}
          onChange={handleMonthChange}
          disabled={disabled}
          className="w-7 bg-transparent outline-none text-center placeholder:text-muted-foreground/50"
          maxLength={2}
        />
        <span className="text-muted-foreground/30 mx-0.5">/</span>
        <input
          ref={yearRef}
          type="text"
          placeholder="YYYY"
          value={year}
          onChange={handleYearChange}
          disabled={disabled}
          className="w-10 bg-transparent outline-none text-center placeholder:text-muted-foreground/50"
          maxLength={4}
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 border-primary/20"
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4 text-primary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
