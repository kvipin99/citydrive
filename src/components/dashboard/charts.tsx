"use client"

import { Bar, BarChart, Line, LineChart, Pie, PieChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"

const revenueData = [
  { month: "Jan", revenue: 18600 },
  { month: "Feb", revenue: 30500 },
  { month: "Mar", revenue: 23700 },
  { month: "Apr", revenue: 27800 },
  { month: "May", revenue: 20900 },
  { month: "Jun", revenue: 25900 },
]

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
}

export function RevenueChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Revenue</CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueChartConfig} className="h-[250px] w-full">
          <BarChart accessibilityLayer data={revenueData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
             <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const profitData = [
    { month: "Jan", profit: 8000 },
    { month: "Feb", profit: 12000 },
    { month: "Mar", profit: 9000 },
    { month: "Apr", profit: 11000 },
    { month: "May", profit: 9500 },
    { month: "Jun", profit: 10500 },
]

const profitChartConfig = {
    profit: {
      label: "Profit",
      color: "hsl(var(--chart-2))",
    },
}

export function ProfitChart() {
    return (
        <Card>
        <CardHeader>
          <CardTitle>Profit Trend</CardTitle>
          <CardDescription>January - June 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={profitChartConfig} className="h-[250px] w-full">
            <LineChart
              accessibilityLayer
              data={profitData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <YAxis />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Line
                dataKey="profit"
                type="monotone"
                stroke="var(--color-profit)"
                strokeWidth={2}
                dot={true}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    )
}


const expenseData = [
    { category: "Salaries", amount: 4500, fill: "var(--color-salaries)" },
    { category: "Fuel", amount: 2200, fill: "var(--color-fuel)" },
    { category: "Maintenance", amount: 1500, fill: "var(--color-maintenance)" },
    { category: "Office", amount: 1200, fill: "var(--color-office)" },
    { category: "Other", amount: 600, fill: "var(--color-other)" },
]
  
const expenseChartConfig = {
    amount: {
        label: "Amount",
    },
    salaries: { label: "Salaries", color: "hsl(var(--chart-1))" },
    fuel: { label: "Fuel", color: "hsl(var(--chart-2))" },
    maintenance: { label: "Maintenance", color: "hsl(var(--chart-3))" },
    office: { label: "Office", color: "hsl(var(--chart-4))" },
    other: { label: "Other", color: "hsl(var(--chart-5))" },
}

export function ExpensesChart() {
    return (
        <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown</CardTitle>
          <CardDescription>Last Month</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={expenseChartConfig}
            className="mx-auto aspect-square h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={expenseData}
                dataKey="amount"
                nameKey="category"
                innerRadius={60}
                strokeWidth={5}
              >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="category" />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    )
}
