import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { schedule } from "@/lib/mock-data";
import { format } from "date-fns";
import { PlusCircle } from "lucide-react";

export default function SchedulePage() {
  const today = new Date();
  const todaysClasses = schedule.filter(c => format(new Date(c.startTime), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
  const upcomingClasses = schedule.filter(c => new Date(c.startTime) > today);

  return (
    <Tabs defaultValue="today">
      <div className="flex items-center mb-6">
        <TabsList>
          <TabsTrigger value="today">Today's Schedule</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <div className="ml-auto">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Schedule Class
          </Button>
        </div>
      </div>
      <TabsContent value="today">
        <Card>
          <CardHeader>
            <CardTitle>Today's Classes</CardTitle>
            <CardDescription>{format(today, "EEEE, MMMM do, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            {todaysClasses.length > 0 ? (
              <ClassList classes={todaysClasses} />
            ) : (
              <p className="text-muted-foreground">No classes scheduled for today.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="upcoming">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Classes scheduled for the future.</CardDescription>
          </CardHeader>
          <CardContent>
             {upcomingClasses.length > 0 ? (
              <ClassList classes={upcomingClasses} />
            ) : (
              <p className="text-muted-foreground">No upcoming classes.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
       <TabsContent value="calendar">
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
            <CardDescription>Full calendar view of all scheduled classes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Full calendar component will be implemented here.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}


function ClassList({ classes }: { classes: typeof schedule }) {
  return (
     <div className="space-y-4">
      {classes.map((c) => (
        <div key={c.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-muted">
          <Avatar>
            <AvatarFallback>{c.studentName.charAt(0)}{c.studentName.split(' ')[1]?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{c.studentName}</p>
            <p className="text-sm text-muted-foreground">w/ {c.instructorName}</p>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {format(new Date(c.startTime), 'p')} - {format(new Date(c.endTime), 'p')}
          </div>
           <div className="text-sm">
             {format(new Date(c.startTime), "MMM d")}
          </div>
        </div>
      ))}
    </div>
  )
}
