"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { instructors } from "@/lib/mock-data";
import { MoreHorizontal, PlusCircle, File } from "lucide-react";

export default function InstructorsPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Instructors</CardTitle>
            <CardDescription>Manage your instructors and their information.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <File className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Instructor
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Assigned Vehicle</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructors.map((instructor) => (
              <TableRow key={instructor.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={instructor.avatarUrl} alt={instructor.name} />
                      <AvatarFallback>{instructor.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-0.5">
                      <span className="font-medium">{instructor.name}</span>
                      <span className="text-xs text-muted-foreground">{instructor.id}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                   <Badge variant={instructor.status === 'Active' ? 'default' : 'secondary'} className={
                      instructor.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      instructor.status === 'On Leave' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                   }>
                    {instructor.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="grid">
                    <span>{instructor.email}</span>
                    <span className="text-muted-foreground">{instructor.phone}</span>
                  </div>
                </TableCell>
                <TableCell>{instructor.vehicle}</TableCell>
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Delete
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
