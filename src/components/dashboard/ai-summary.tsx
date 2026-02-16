"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminPerformanceSummary, type AdminPerformanceSummaryInput } from "@/ai/flows/admin-performance-summary-flow";
import { Sparkles, Lightbulb } from "lucide-react";

const mockInput: AdminPerformanceSummaryInput = {
    reportingPeriod: 'Last Month',
    totalStudents: 125,
    activeStudents: 88,
    monthlyRevenue: 15600,
    monthlyExpenses: 7200,
    netProfit: 8400,
    pendingPaymentsCount: 12,
    upcomingClassesCount: 45,
    monthlyRevenueTrend: [
        { month: 'Jan', revenue: 12000 },
        { month: 'Feb', revenue: 14500 },
        { month: 'Mar', revenue: 13000 },
        { month: 'Apr', revenue: 15600 },
    ],
    monthlyProfitTrend: [
        { month: 'Jan', profit: 5000 },
        { month: 'Feb', profit: 7000 },
        { month: 'Mar', profit: 6200 },
        { month: 'Apr', profit: 8400 },
    ],
    expenseBreakdown: [
        { category: 'Fuel', amount: 1500 },
        { category: 'Salaries', amount: 4000 },
        { category: 'Maintenance', amount: 800 },
        { category: 'Office', amount: 900 },
    ],
};


export default function AiSummary() {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateSummary = async () => {
        setIsLoading(true);
        setSummary('');
        try {
            const result = await getAdminPerformanceSummary(mockInput);
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
                        Get an AI-generated summary of your school's performance.
                    </CardDescription>
                </div>
                <Button onClick={handleGenerateSummary} disabled={isLoading}>
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
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                        {summary.split('\n').map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                )}
                {!isLoading && !summary && (
                     <div className="text-center text-muted-foreground py-8">
                        Click "Generate Summary" to see your performance analysis.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
