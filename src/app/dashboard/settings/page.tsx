"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, ShieldCheck, DatabaseBackup } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();

  const handleSaveChanges = (section: string) => {
    toast({
      title: "Settings Saved",
      description: `Your changes to the ${section} settings have been saved.`,
    });
  };

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="automation">Automation</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Manage your driving school's information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">School Name</Label>
              <Input id="school-name" defaultValue="Citydrive" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-email">Contact Email</Label>
              <Input id="school-email" type="email" defaultValue="contact@citydriving.in" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-phone">Contact Phone</Label>
              <Input id="school-phone" type="tel" defaultValue="555-0123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-address">Address</Label>
              <Input id="school-address" defaultValue="123 Driving Rd, Suite 100, Carville, ST 12345" />
            </div>
            <Button onClick={() => handleSaveChanges('General')}>Save Changes</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>Admin Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Name</Label>
              <Input id="admin-name" defaultValue="Admin User" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" defaultValue="admin@citydriving.in" />
            </div>
            <Button variant="outline">Change Password</Button>
            <br/>
            <Button onClick={() => handleSaveChanges('Profile')}>Save Changes</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automation">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 text-primary" />
              Backup Automation
            </CardTitle>
            <CardDescription>Configure automatic email backups (Twice per week).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Auto-Backup</Label>
                  <p className="text-sm text-muted-foreground">Automatically send database snapshots twice a week.</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="backup-email">Destination Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="backup-email" type="email" className="pl-9" defaultValue="admin@citydriving.in" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Backup Frequency</Label>
                <Select defaultValue="twice-week">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Every 24 Hours)</SelectItem>
                    <SelectItem value="twice-week">Twice a Week (Every 3.5 Days)</SelectItem>
                    <SelectItem value="weekly">Weekly (Every 7 Days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Next automated backup scheduled for 3 days from now.
              </div>
            </div>
            
            <Separator />
            
            <Button onClick={() => handleSaveChanges('Automation')}>Update Automation Settings</Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
