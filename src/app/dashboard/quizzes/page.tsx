
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function QuizzesPage() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center space-y-4">
      <ShieldAlert className="h-16 w-16 text-destructive opacity-20" />
      <h2 className="text-2xl font-bold">Feature Unavailable</h2>
      <p className="text-muted-foreground max-w-md">
        The Quiz module has been decommissioned and is no longer available in the portal.
      </p>
    </div>
  );
}
