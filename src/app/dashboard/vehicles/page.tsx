
'use client';

import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, Car, Calendar, ShieldCheck, FileText, Trash2, Edit2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isValid, parseISO } from "date-fns";

const VEHICLE_TYPES = ["2wlr", "3wlr", "4wlr", "Heavy", "Other"] as const;
const VEHICLE_STATUSES = ["Available", "In Use", "Maintenance"] as const;

interface Vehicle {
  id: string;
  regNumber: string;
  type: typeof VEHICLE_TYPES[number];
  brandModel: string;
  regValidity: any; 
  insuranceValidity: any;
  status: typeof VEHICLE_STATUSES[number];
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export default function VehiclesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user?.uid]);
  
  const { data: profile } = useDoc(userProfileRef);
  const canWrite = profile?.role === 'Admin' || profile?.role === 'BranchManager';

  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user?.uid]);

  const { data: vehicles, isLoading: isVehiclesLoading } = useCollection<Vehicle>(vehiclesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    regNumber: '',
    type: '4wlr' as typeof VEHICLE_TYPES[number],
    brandModel: '',
    regValidity: '',
    insuranceValidity: '',
    status: 'Available' as typeof VEHICLE_STATUSES[number]
  });

  const toInputDate = useCallback((val: any) => {
    if (!val) return '';
    try {
      let d: Date;
      if (val && typeof val.toDate === 'function') {
        d = val.toDate();
      } else if (val && typeof val.seconds === 'number') {
        d = new Date(val.seconds * 1000);
      } else if (typeof val === 'string') {
        d = parseISO(val);
      } else {
        d = new Date(val);
      }
      return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
    } catch {
      return '';
    }
  }, []);

  const handleOpenDialog = useCallback((vehicle: Vehicle | null = null) => {
    if (vehicle) {
      setSelectedVehicleId(vehicle.id);
      setFormData({
        regNumber: vehicle.regNumber || '',
        type: vehicle.type || '4wlr',
        brandModel: vehicle.brandModel || '',
        regValidity: toInputDate(vehicle.regValidity),
        insuranceValidity: toInputDate(vehicle.insuranceValidity),
        status: vehicle.status || 'Available'
      });
    } else {
      setSelectedVehicleId(null);
      setFormData({
        regNumber: '',
        type: '4wlr',
        brandModel: '',
        regValidity: '',
        insuranceValidity: '',
        status: 'Available'
      });
    }
    // Micro-delay to prevent UI "stuck" state
    setTimeout(() => setIsDialogOpen(true), 150);
  }, [toInputDate]);

  const handleSaveVehicle = () => {
    if (!formData.regNumber || !formData.brandModel) {
      toast({ variant: "destructive", title: "Missing Data", description: "Registration Number and Brand/Model are required." });
      return;
    }
    const vehicleId = selectedVehicleId ? selectedVehicleId : `V-${Date.now()}`;
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const updateData = {
      regNumber: formData.regNumber.trim().toUpperCase(),
      type: formData.type,
      brandModel: formData.brandModel.trim(),
      regValidity: formData.regValidity,
      insuranceValidity: formData.insuranceValidity,
      status: formData.status,
      id: vehicleId,
      updatedAt: serverTimestamp(),
      ...(selectedVehicleId ? {} : { createdAt: serverTimestamp(), createdBy: user?.uid })
    };
    setDocumentNonBlocking(vehicleRef, updateData, { merge: true });
    
    setTimeout(() => {
      setIsDialogOpen(false);
      setSelectedVehicleId(null);
      toast({ title: selectedVehicleId ? "Vehicle Updated" : "Vehicle Added" });
    }, 150);
  };

  const handleDeleteVehicle = (id: string) => {
    const vehicleRef = doc(db, 'vehicles', id);
    deleteDocumentNonBlocking(vehicleRef);
    toast({ variant: "destructive", title: "Vehicle Deleted" });
  };

  const formatSafeDate = useCallback((dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      let d: Date;
      if (dateVal && typeof dateVal.toDate === 'function') d = dateVal.toDate();
      else if (dateVal && typeof dateVal.seconds === 'number') d = new Date(dateVal.seconds * 1000);
      else if (typeof dateVal === 'string') d = parseISO(dateVal);
      else d = new Date(dateVal);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : 'N/A';
    } catch { return 'N/A'; }
  }, []);

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
              <CardDescription>Track vehicle details and validity.</CardDescription>
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
          {isVehiclesLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
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
                {!vehicles || vehicles.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No vehicles found.</TableCell></TableRow>
                ) : (
                  vehicles.map((v) => (
                    <TableRow key={v.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell><div className="grid gap-0.5"><span className="font-bold text-primary">{v.regNumber}</span><Badge variant="outline" className="w-fit text-[10px] uppercase font-mono">{v.type}</Badge></div></TableCell>
                      <TableCell className="font-medium">{v.brandModel}</TableCell>
                      <TableCell><div className="grid gap-1 text-[10px] uppercase font-bold tracking-tight"><div className="flex items-center gap-1.5 text-muted-foreground"><FileText className="h-3 w-3" /> Reg: <span className="text-foreground">{formatSafeDate(v.regValidity)}</span></div><div className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Ins: <span className="text-foreground">{formatSafeDate(v.insuranceValidity)}</span></div></div></TableCell>
                      <TableCell><Badge variant={v.status === 'Available' ? 'default' : 'secondary'} className="text-[10px] font-bold">{v.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {canWrite && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(v); }}>
                                <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive font-bold" onSelect={(e) => { e.preventDefault(); handleDeleteVehicle(v.id); }}>
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) { setIsDialogOpen(false); setSelectedVehicleId(null); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 pb-2"><DialogTitle>{selectedVehicleId ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle><DialogDescription>Validity details.</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-4 px-6 py-4 pb-32">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Reg Number</Label><Input placeholder="MH-12..." value={formData.regNumber} onChange={(e) => setFormData({...formData, regNumber: e.target.value.toUpperCase()})} /></div>
                <div className="grid gap-2"><Label>Type</Label><Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VEHICLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid gap-2"><Label>Brand & Model</Label><Input value={formData.brandModel} onChange={(e) => setFormData({...formData, brandModel: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Reg Validity</Label><Input type="date" value={formData.regValidity} onChange={(e) => setFormData({...formData, regValidity: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Ins Validity</Label><Input type="date" value={formData.insuranceValidity} onChange={(e) => setFormData({...formData, insuranceValidity: e.target.value})} /></div>
              </div>
              <div className="grid gap-2"><Label>Status</Label><Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VEHICLE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-2 border-t bg-muted/10"><Button onClick={handleSaveVehicle} className="w-full">Save Vehicle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
