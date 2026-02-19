"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

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
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
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

      <TabsContent value="notifications">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage how you receive notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Email Notifications</h3>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <p className="text-sm">New Student Registrations</p>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <p className="text-sm">Class Cancellations</p>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <p className="text-sm">Weekly Performance Summary</p>
                <Switch />
              </div>
            </div>
            <Separator />
             <div className="space-y-2">
              <h3 className="text-lg font-medium">Push Notifications</h3>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <p className="text-sm">Urgent Alerts</p>
                <Switch defaultChecked />
              </div>
            </div>
            <Button onClick={() => handleSaveChanges('Notifications')}>Save Changes</Button>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="billing">
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Manage your subscription and payment methods.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You are currently on the <strong>Pro Plan</strong>.</p>
            <p className="text-muted-foreground">Your next bill for ₹9,900 is on August 1, 2024.</p>
            <div className="flex gap-2">
                <Button>Upgrade Plan</Button>
                <Button variant="outline">View Billing History</Button>
            </div>
            <Separator/>
            <div className="space-y-2">
                <h3 className="text-lg font-medium">Payment Method</h3>
                <div className="rounded-lg border p-4">
                    <p>Visa ending in 1234</p>
                    <p className="text-muted-foreground">Expires 12/2026</p>
                </div>
                <Button variant="outline">Update Payment Method</Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  );
}
