
"use client"

import { useMemo } from 'react'
import { Bar, BarChart, Line, LineChart, Pie, PieChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { collection } from "firebase/firestore"
import { format, subMonths, startOfMonth, isWithinInterval, endOfMonth } from 'date-fns'

export function RevenueChart() {
  const db = useFirestore();
  const { user } = useUser();

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'payments');
  }, [db, user]);

  const { data: payments } = useCollection(paymentsQuery);

  const revenueData = useMemo(() => {
    const today = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(today, 5 - i);
      return {
        month: format(date, 'MMM'),
        fullName: format(date, 'MMMM yyyy'),
        start: startOfMonth(date),
        end: endOfMonth(date),
        revenue: 0
      };
    });

    payments?.forEach(p => {
      const pDate = p.date?.seconds ? new Date(p.date.seconds * 1000) : null;
      if (pDate) {
        months.forEach(m => {
          if (isWithinInterval(pDate, { start: m.start, end: m.end })) {
            m.revenue += (Number(p.amount) || 0);
          }
        });
      }
    });

    return months;
  }, [payments]);

  const config = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Revenue</CardTitle>
        <CardDescription>Last 6 Months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <BarChart accessibilityLayer data={revenueData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function ProfitChart() {
  const db = useFirestore();
  const { user } = useUser();

  const paymentsQuery = useMemoFirebase(() => (db && user ? collection(db, 'payments') : null), [db, user]);
  const expensesQuery = useMemoFirebase(() => (db && user ? collection(db, 'expenses') : null), [db, user]);

  const { data: payments } = useCollection(paymentsQuery);
  const { data: expenses } = useCollection(expensesQuery);

  const profitData = useMemo(() => {
    const today = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(today, 5 - i);
      return {
        month: format(date, 'MMM'),
        start: startOfMonth(date),
        end: endOfMonth(date),
        profit: 0
      };
    });

    months.forEach(m => {
      const monthRevenue = payments?.filter(p => {
        const d = p.date?.seconds ? new Date(p.date.seconds * 1000) : null;
        return d && isWithinInterval(d, { start: m.start, end: m.end });
      }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;

      const monthExpenses = expenses?.filter(e => {
        const d = e.date ? new Date(e.date) : null;
        return d && isWithinInterval(d, { start: m.start, end: m.end });
      }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      m.profit = monthRevenue - monthExpenses;
    });

    return months;
  }, [payments, expenses]);

  const config = {
    profit: { label: "Profit", color: "hsl(var(--chart-2))" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit Trend</CardTitle>
        <CardDescription>Last 6 Months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart accessibilityLayer data={profitData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Line dataKey="profit" type="monotone" stroke="var(--color-profit)" strokeWidth={2} dot={true} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function ExpensesChart() {
  const db = useFirestore();
  const { user } = useUser();

  const expensesQuery = useMemoFirebase(() => (db && user ? collection(db, 'expenses') : null), [db, user]);
  const { data: expenses } = useCollection(expensesQuery);

  const expenseData = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses?.forEach(e => {
      const cat = e.category || 'Others';
      categories[cat] = (categories[cat] || 0) + (Number(e.amount) || 0);
    });

    const colors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
    return Object.entries(categories).map(([category, amount], i) => ({
      category,
      amount,
      fill: `var(${colors[i % colors.length]})`
    }));
  }, [expenses]);

  const config = {
    amount: { label: "Amount" },
    ...Object.fromEntries(expenseData.map((d, i) => [d.category, { label: d.category, color: `hsl(var(--chart-${(i % 5) + 1}))` }]))
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Breakdown</CardTitle>
        <CardDescription>All Time Expenditure</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square h-[250px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie data={expenseData} dataKey="amount" nameKey="category" innerRadius={60} strokeWidth={5}>
              {expenseData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="category" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
