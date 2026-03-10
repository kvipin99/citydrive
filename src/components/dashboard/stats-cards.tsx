'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Users } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { format, isValid, parseISO } from 'date-fns';

export default function StatsCards() {
    const db = useFirestore();
    const { user } = useUser();

    const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
    const { data: profile } = useDoc(userProfileRef);
    
    // Explicit Admin/Master check
    const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';

    const paymentsQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'payments');
        if (!profile.branch) return null;
        return query(collection(db, 'payments'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const expensesQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'expenses');
        if (!profile.branch) return null;
        return query(collection(db, 'expenses'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const studentsQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'students');
        if (!profile.branch) return null;
        return query(collection(db, 'students'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
    const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);
    const { data: students, isLoading: isStudentsLoading } = useCollection(studentsQuery);

    const stats = useMemo(() => {
        if (!profile || !payments || !expenses || !students) return [];

        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const thisMonthKey = format(today, 'yyyy-MM');

        const parseSafeDate = (d: any) => {
            if (!d) return null;
            if (d.seconds) return new Date(d.seconds * 1000);
            const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
            return isValid(parsed) ? parsed : null;
        };

        // Calculations for Today
        const todayRevenue = payments.filter(p => {
            const d = parseSafeDate(p.date);
            return d && format(d, 'yyyy-MM-dd') === todayStr;
        }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const todayExpense = expenses.filter(e => {
            const d = parseSafeDate(e.date);
            return d && format(d, 'yyyy-MM-dd') === todayStr;
        }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        // Calculations for This Month
        const monthlyRevenue = payments.filter(p => {
            const d = parseSafeDate(p.date);
            return d && format(d, 'yyyy-MM') === thisMonthKey;
        }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const monthlyExpense = expenses.filter(e => {
            const d = parseSafeDate(e.date);
            return d && format(d, 'yyyy-MM') === thisMonthKey;
        }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const activeStudentsCount = students.filter(s => s.status === 'Active').length;

        const todayProfit = todayRevenue - todayExpense;
        const monthlyProfit = monthlyRevenue - monthlyExpense;

        const baseStats = [
            { 
                title: "Active Students", 
                value: activeStudentsCount.toString(), 
                icon: <Users className="h-4 w-4 text-primary" />, 
                description: "Currently enrolled",
                trend: "neutral"
            },
            { 
                title: "Today's Revenue", 
                value: `₹${todayRevenue.toLocaleString()}`, 
                icon: <DollarSign className="h-4 w-4 text-green-500" />, 
                description: format(today, 'EEE, MMM dd'),
                trend: todayRevenue > 0 ? "positive" : "neutral"
            },
            { 
                title: "Today's Net Profit", 
                value: `₹${todayProfit.toLocaleString()}`, 
                icon: <Wallet className="h-4 w-4 text-primary" />, 
                description: "Net intake today",
                trend: todayProfit >= 0 ? "positive" : "negative"
            }
        ];

        // ADD MONTHLY STATS ONLY FOR ADMINS
        if (isAdmin) {
            baseStats.push(
                { 
                    title: "Monthly Revenue", 
                    value: `₹${monthlyRevenue.toLocaleString()}`, 
                    icon: <DollarSign className="h-4 w-4 text-green-600" />, 
                    description: format(today, 'MMMM yyyy'),
                    trend: "neutral"
                },
                { 
                    title: "Monthly Net Profit", 
                    value: `₹${monthlyProfit.toLocaleString()}`, 
                    icon: <Wallet className="h-4 w-4 text-primary" />, 
                    description: "This month's net",
                    trend: monthlyProfit >= 0 ? "positive" : "negative"
                }
            );
        }

        return baseStats;
    }, [payments, expenses, students, profile, isAdmin]);

    if (isPaymentsLoading || isExpensesLoading || isStudentsLoading || !profile) {
        return (
            <div className={`grid gap-4 md:grid-cols-3 ${isAdmin ? 'lg:grid-cols-5' : ''}`}>
                {[1, 2, 3, ...(isAdmin ? [4, 5] : [])].map((i) => (
                    <Card key={i} className="animate-pulse shadow-sm border-primary/10">
                        <CardHeader className="h-10 bg-muted/50 rounded-t-lg" />
                        <CardContent className="h-20 bg-muted/30" />
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className={`grid gap-4 md:grid-cols-3 ${isAdmin ? 'lg:grid-cols-5' : ''}`}>
            {stats.map((stat) => (
                <Card key={stat.title} className="shadow-sm border-primary/10 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            {stat.title}
                        </CardTitle>
                        {stat.icon}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-black ${stat.trend === 'negative' ? 'text-red-600' : 'text-foreground'}`}>
                            {stat.value}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {stat.trend === 'positive' && <ArrowUpRight className="h-3 w-3 text-green-500" />}
                            {stat.trend === 'negative' && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                                {stat.description}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}