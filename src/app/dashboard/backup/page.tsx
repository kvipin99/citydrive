"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DownloadCloud, UploadCloud, History } from "lucide-react";

export default function BackupPage() {
  const { toast } = useToast();

  const handleBackup = () => {
    toast({
      title: "Backup Started",
      description: "Your data is being backed up. This may take a few minutes.",
    });
  };

  const handleRestore = () => {
    toast({
      title: "Restore Initialized",
      description: "System is preparing to restore from the latest backup.",
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Data Backup & Restore</CardTitle>
          <CardDescription>
            Secure your application data by creating backups. You can restore your data from a previous point in time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Backups include all student records, instructor profiles, vehicle data, schedules, and financial records. Backups are stored securely in the cloud.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleBackup}>
              <DownloadCloud className="mr-2 h-4 w-4" />
              Backup Data Now
            </Button>
            <Button onClick={handleRestore} variant="outline">
              <UploadCloud className="mr-2 h-4 w-4" />
              Restore from Backup
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            Review your recent backup activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center">
              <History className="h-5 w-5 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium">Daily Backup - July 28, 2024</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <p className="ml-auto text-sm text-muted-foreground">2:00 AM</p>
            </div>
             <div className="flex items-center">
              <History className="h-5 w-5 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium">Daily Backup - July 27, 2024</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <p className="ml-auto text-sm text-muted-foreground">2:00 AM</p>
            </div>
             <div className="flex items-center">
              <History className="h-5 w-5 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium">Manual Backup - July 26, 2024</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <p className="ml-auto text-sm text-muted-foreground">3:45 PM</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
