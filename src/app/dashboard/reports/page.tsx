"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Users, DollarSign, Calendar, Car } from "lucide-react";

const reports = [
  {
    title: "Financial Summary",
    description: "Overview of revenue, expenses, and profit over a selected period.",
    icon: <DollarSign className="w-8 h-8 text-primary" />,
  },
  {
    title: "Student Enrollment",
    description: "Track student registration trends and active student counts.",
    icon: <Users className="w-8 h-8 text-primary" />,
  },
  {
    title: "Instructor Performance",
    description: "Analyze instructor schedules, class completion rates, and student feedback.",
    icon: <BarChart className="w-8 h-8 text-primary" />,
  },
  {
    title: "Class Scheduling",
    description: "Report on class frequency, popular times, and cancellations.",
    icon: <Calendar className="w-8 h-8 text-primary" />,
  },
  {
    title: "Vehicle Utilization",
    description: "Monitor vehicle usage, maintenance schedules, and fuel costs.",
    icon: <Car className="w-8 h-8 text-primary" />,
  },
   {
    title: "Payment Dues",
    description: "List of all outstanding and overdue payments from students.",
    icon: <ReceiptIcon className="w-8 h-8 text-primary" />,
  },
];


export default function ReportsPage() {
  const { toast } = useToast();

  const handleGenerateReport = (title: string) => {
    toast({
      title: "Generating Report",
      description: `Your "${title}" report is being generated and will be available for download shortly.`,
    });
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <Card key={report.title} className="flex flex-col">
          <CardHeader>
            <div className="flex items-start gap-4">
              {report.icon}
              <div className="grid gap-1">
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow">
            {/* Can add filter options here in the future */}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => handleGenerateReport(report.title)}>
              Generate Report
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ReceiptIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  )
}
