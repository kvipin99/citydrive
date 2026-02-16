"use client"

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { vehicles } from "@/lib/mock-data";
import { MoreHorizontal, PlusCircle, File } from "lucide-react";

export default function VehiclesPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Vehicles</CardTitle>
            <CardDescription>Manage your school's fleet of vehicles.</CardDescription>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>License Plate</TableHead>
              <TableHead>Next Service</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Image src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} width={80} height={50} className="rounded-md" />
                    <div className="grid gap-0.5">
                      <span className="font-medium">{vehicle.make} {vehicle.model} ({vehicle.year})</span>
                      <span className="text-xs text-muted-foreground">{vehicle.id}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={vehicle.status === 'Available' ? 'default' : 'secondary'} className={
                      vehicle.status === 'Available' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      vehicle.status === 'In Use' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                   }>
                    {vehicle.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-mono">{vehicle.licensePlate}</div>
                </TableCell>
                <TableCell>{new Date(vehicle.nextService).toLocaleDateString()}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>View Maintenance Log</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Remove Vehicle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
