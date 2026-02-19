import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Activity, Wallet } from "lucide-react";

const stats = [
    { title: "Total Students", value: "1,250", icon: <Users className="h-4 w-4 text-muted-foreground" />, change: "+20.1% from last month" },
    { title: "Active Students", value: "882", icon: <Activity className="h-4 w-4 text-muted-foreground" />, change: "+180 since last hour" },
    { title: "Monthly Revenue", value: "₹1,56,000", icon: <DollarSign className="h-4 w-4 text-muted-foreground" />, change: "+12.2% from last month" },
    { title: "Net Profit", value: "₹84,000", icon: <Wallet className="h-4 w-4 text-muted-foreground" />, change: "+8.5% from last month" }
]

export default function StatsCards() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
                <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {stat.title}
                        </CardTitle>
                        {stat.icon}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <p className="text-xs text-muted-foreground">
                            {stat.change}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
