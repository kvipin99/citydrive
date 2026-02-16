import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const classes = [
  { student: "Liam Johnson", instructor: "Olivia Smith", time: "9:00 AM - 10:00 AM" },
  { student: "Emma Williams", instructor: "Noah Brown", time: "10:00 AM - 11:00 AM" },
  { student: "James Davis", instructor: "Olivia Smith", time: "11:00 AM - 12:00 PM" },
  { student: "Sophia Miller", instructor: "Ethan Wilson", time: "1:00 PM - 2:00 PM" },
];

export default function UpcomingClasses() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Classes</CardTitle>
        <CardDescription>Here are the driving classes scheduled for today.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {classes.map((c, index) => (
            <div key={index} className="flex items-center space-x-4">
              <Avatar>
                <AvatarFallback>{c.student.charAt(0)}{c.student.split(' ')[1].charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{c.student}</p>
                <p className="text-sm text-muted-foreground">Instructor: {c.instructor}</p>
              </div>
              <div className="text-sm font-medium text-muted-foreground">{c.time}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
