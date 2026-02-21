
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Activity, Wallet } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";

export default function StatsCards() {
    const db = useFirestore();
    const { user } = useUser();

    const studentsQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return collection(db, 'students');
    }, [db, user]);

    const paymentsQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return collection(db, 'payments');
    }, [db, user]);

    const expensesQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return collection(db, 'expenses');
    }, [db, user]);

    const { data: students, isLoading: isStudentsLoading } = useCollection(studentsQuery);
    const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
    const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

    const stats = useMemo(() => {
        const totalStudents = students?.length || 0;
        const activeStudents = students?.filter(s => s.status === 'Active').length || 0;
        const totalRevenue = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
        const netProfit = totalRevenue - totalExpenses;

        return [
            { title: "Total Students", value: totalStudents.toLocaleString(), icon: <Users className="h-4 w-4 text-muted-foreground" />, change: "All recorded registrations" },
            { title: "Active Students", value: activeStudents.toLocaleString(), icon: <Activity className="h-4 w-4 text-muted-foreground" />, change: "Currently in training" },
            { title: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: <DollarSign className="h-4 w-4 text-muted-foreground" />, change: "Total fees collected" },
            { title: "Net Profit", value: `₹${netProfit.toLocaleString()}`, icon: <Wallet className="h-4 w-4 text-muted-foreground" />, change: "Revenue minus expenses" }
        ];
    }, [students, payments, expenses]);

    if (isStudentsLoading || isPaymentsLoading || isExpensesLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader className="h-10 bg-muted/50 rounded-t-lg" />
                        <CardContent className="h-20 bg-muted/30" />
                    </Card>
                ))}
            </div>
        );
    }

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
