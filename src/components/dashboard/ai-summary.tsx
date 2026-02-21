
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminPerformanceSummary } from "@/ai/flows/admin-performance-summary-flow";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Sparkles, Lightbulb } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from 'date-fns';

export default function AiSummary() {
    const db = useFirestore();
    const { user } = useUser();
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
    const { data: profile } = useDoc(userProfileRef);
    const isAdmin = profile?.role === 'Admin';

    const studentsQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'students');
        return query(collection(db, 'students'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const paymentsQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'payments');
        return query(collection(db, 'payments'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const expensesQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'expenses');
        return query(collection(db, 'expenses'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const classesQuery = useMemoFirebase(() => {
        if (!db || !user || !profile) return null;
        if (isAdmin) return collection(db, 'classes');
        return query(collection(db, 'classes'), where('branch', '==', profile.branch));
    }, [db, user, profile, isAdmin]);

    const { data: students } = useCollection(studentsQuery);
    const { data: payments } = useCollection(paymentsQuery);
    const { data: expenses } = useCollection(expensesQuery);
    const { data: classes } = useCollection(classesQuery);

    const performanceData = useMemo(() => {
        if (!students || !payments || !expenses) return null;

        const today = new Date();
        const thisMonthStart = startOfMonth(today);
        const thisMonthEnd = endOfMonth(today);

        const currentMonthRevenue = payments.filter(p => {
            const d = p.date?.seconds ? new Date(p.date.seconds * 1000) : null;
            return d && isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd });
        }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const currentMonthExpenses = expenses.filter(e => {
            const d = e.date ? new Date(e.date) : null;
            return d && isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd });
        }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const revenueTrend = Array.from({ length: 4 }, (_, i) => {
            const d = subMonths(today, 3 - i);
            const start = startOfMonth(d);
            const end = endOfMonth(d);
            const rev = payments.filter(p => {
                const pd = p.date?.seconds ? new Date(p.date.seconds * 1000) : null;
                return pd && isWithinInterval(pd, { start, end });
            }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            return { month: format(d, 'MMM'), revenue: rev };
        });

        const profitTrend = Array.from({ length: 4 }, (_, i) => {
            const d = subMonths(today, 3 - i);
            const start = startOfMonth(d);
            const end = endOfMonth(d);
            const rev = payments.filter(p => {
                const pd = p.date?.seconds ? new Date(p.date.seconds * 1000) : null;
                return pd && isWithinInterval(pd, { start, end });
            }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const exp = expenses.filter(e => {
                const ed = e.date ? new Date(e.date) : null;
                return ed && isWithinInterval(ed, { start, end });
            }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            return { month: format(d, 'MMM'), profit: rev - exp };
        });

        const catMap: Record<string, number> = {};
        expenses.forEach(e => {
            const d = e.date ? new Date(e.date) : null;
            if (d && isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd })) {
                catMap[e.category] = (catMap[e.category] || 0) + (Number(e.amount) || 0);
            }
        });

        const upcoming = classes?.filter(c => {
            const d = c.startTime ? new Date(c.startTime) : null;
            return d && isSameDay(d, today);
        }).length || 0;

        return {
            reportingPeriod: `${isAdmin ? 'Full School' : profile?.branch} - ${format(today, 'MMMM yyyy')}`,
            totalStudents: students.length,
            activeStudents: students.filter(s => s.status === 'Active').length,
            monthlyRevenue: currentMonthRevenue,
            monthlyExpenses: currentMonthExpenses,
            netProfit: currentMonthRevenue - currentMonthExpenses,
            pendingPaymentsCount: students.filter(s => {
                const paid = s.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
                return (s.amount || 0) > paid;
            }).length,
            upcomingClassesCount: upcoming,
            monthlyRevenueTrend: revenueTrend,
            monthlyProfitTrend: profitTrend,
            expenseBreakdown: Object.entries(catMap).map(([category, amount]) => ({ category, amount }))
        };
    }, [students, payments, expenses, classes, isAdmin, profile]);

    const handleGenerateSummary = async () => {
        if (!performanceData) return;
        setIsLoading(true);
        setSummary('');
        try {
            const result = await getAdminPerformanceSummary(performanceData);
            setSummary(result);
        } catch (error) {
            console.error("Failed to generate AI summary:", error);
            setSummary("There was an error generating the performance summary. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-400" />
                        AI-Powered Performance Insights
                    </CardTitle>
                    <CardDescription>
                        Summary for {performanceData?.reportingPeriod || 'this month'}.
                    </CardDescription>
                </div>
                <Button onClick={handleGenerateSummary} disabled={isLoading || !performanceData}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Summary
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>
                )}
                {summary && (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap">
                        {summary}
                    </div>
                )}
                {!isLoading && !summary && (
                     <div className="text-center text-muted-foreground py-8">
                        {performanceData ? 'Click "Generate Summary" for insights.' : 'Loading school data...'}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
