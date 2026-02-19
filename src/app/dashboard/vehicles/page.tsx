'use client';

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { type Vehicle } from "@/lib/mock-data";
import { MoreHorizontal, PlusCircle, File, Wrench } from "lucide-react";

export default function VehiclesPage() {
  const db = useFirestore();
  const vehiclesQuery = useMemoFirebase(() => collection(db, 'vehicles'), [db]);
  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesQuery);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fleet Management</CardTitle>
            <CardDescription>Track maintenance and availability of school vehicles.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <File className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
           <div className="flex justify-center py-8">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
           </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Next Service</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No vehicles registered in the fleet.
                  </TableCell>
                </TableRow>
              ) : (
                vehicles?.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-20 overflow-hidden rounded-md border bg-muted">
                          {vehicle.imageUrl ? (
                            <Image 
                              src={vehicle.imageUrl} 
                              alt={vehicle.make} 
                              fill 
                              className="object-cover" 
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Wrench className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="grid gap-0.5">
                          <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                          <span className="text-xs text-muted-foreground">{vehicle.year}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vehicle.status === 'Available' ? 'default' : 'secondary'}>
                        {vehicle.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{vehicle.licensePlate}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         <span className="text-sm">{new Date(vehicle.nextService).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Service Log</DropdownMenuItem>
                          <DropdownMenuItem>Edit Details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Decommission</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
