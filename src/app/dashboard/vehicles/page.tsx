'use client';

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, Car, Calendar, ShieldCheck, FileText, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const VEHICLE_TYPES = ["2wlr", "3wlr", "4wlr", "Heavy", "Other"] as const;
const VEHICLE_STATUSES = ["Available", "In Use", "Maintenance"] as const;

interface Vehicle {
  id: string;
  regNumber: string;
  type: typeof VEHICLE_TYPES[number];
  brandModel: string;
  regValidity: string;
  insuranceValidity: string;
  status: typeof VEHICLE_STATUSES[number];
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export default function VehiclesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const canWrite = profile?.role === 'Admin' || profile?.role === 'BranchManager';

  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user]);

  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    regNumber: '',
    type: '4wlr',
    brandModel: '',
    regValidity: '',
    insuranceValidity: '',
    status: 'Available'
  });

  const handleOpenDialog = (vehicle: Vehicle | null = null) => {
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setFormData({ ...vehicle });
    } else {
      setSelectedVehicle(null);
      setFormData({
        regNumber: '',
        type: '4wlr',
        brandModel: '',
        regValidity: '',
        insuranceValidity: '',
        status: 'Available'
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveVehicle = () => {
    if (!formData.regNumber || !formData.brandModel) {
      toast({ variant: "destructive", title: "Missing Data", description: "Registration Number and Brand/Model are required." });
      return;
    }

    const vehicleId = selectedVehicle ? selectedVehicle.id : `V-${Date.now()}`;
    const vehicleRef = doc(db, 'vehicles', vehicleId);

    const data = {
      ...formData,
      id: vehicleId,
      updatedAt: serverTimestamp(),
      ...(selectedVehicle ? {} : { createdAt: serverTimestamp(), createdBy: user?.uid })
    };

    setDocumentNonBlocking(vehicleRef, data, { merge: true });
    setIsDialogOpen(false);
    toast({ title: selectedVehicle ? "Vehicle Updated" : "Vehicle Added", description: `${formData.regNumber} has been saved to the fleet.` });
  };

  const handleDeleteVehicle = (id: string) => {
    const vehicleRef = doc(db, 'vehicles', id);
    deleteDocumentNonBlocking(vehicleRef);
    toast({ variant: "destructive", title: "Vehicle Deleted", description: "The vehicle has been removed from the fleet." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                Fleet Management
              </CardTitle>
              <CardDescription>Track vehicle details, registration, and insurance validity.</CardDescription>
            </div>
            {canWrite && (
              <Button onClick={() => handleOpenDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Vehicle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg Number & Type</TableHead>
                  <TableHead>Brand & Model</TableHead>
                  <TableHead>Validity Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No vehicles found. Add your first vehicle to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicles?.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-primary">{v.regNumber}</span>
                          <Badge variant="outline" className="w-fit text-[10px] uppercase">{v.type}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{v.brandModel}</TableCell>
                      <TableCell>
                        <div className="grid gap-1 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <FileText className="h-3 w-3" /> Reg: {v.regValidity ? format(new Date(v.regValidity), 'MMM dd, yyyy') : 'N/A'}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ShieldCheck className="h-3 w-3" /> Ins: {v.insuranceValidity ? format(new Date(v.insuranceValidity), 'MMM dd, yyyy') : 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.status === 'Available' ? 'default' : 'secondary'}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canWrite && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenDialog(v)}>
                                <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteVehicle(v.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Vehicle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
            <DialogDescription>Enter registration and validity details for the fleet vehicle.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="regNumber">Reg Number</Label>
                <Input 
                  id="regNumber" 
                  placeholder="e.g. MH-12-AB-1234" 
                  value={formData.regNumber} 
                  onChange={(e) => setFormData({...formData, regNumber: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Vehicle Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="brandModel">Brand & Model</Label>
              <Input 
                id="brandModel" 
                placeholder="e.g. Maruti Suzuki Swift" 
                value={formData.brandModel} 
                onChange={(e) => setFormData({...formData, brandModel: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Reg Validity</Label>
                <Input 
                  type="date" 
                  value={formData.regValidity} 
                  onChange={(e) => setFormData({...formData, regValidity: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Insurance Validity</Label>
                <Input 
                  type="date" 
                  value={formData.insuranceValidity} 
                  onChange={(e) => setFormData({...formData, insuranceValidity: e.target.value})} 
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Current Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveVehicle} className="w-full">Save Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
