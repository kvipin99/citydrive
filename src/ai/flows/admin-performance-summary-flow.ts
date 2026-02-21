'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating an AI-powered summary of the driving school's performance.
 *
 * - getAdminPerformanceSummary - A function that fetches and summarizes the driving school's performance data.
 * - AdminPerformanceSummaryInput - The input type for the getAdminPerformanceSummary function.
 * - AdminPerformanceSummaryOutput - The return type for the getAdminPerformanceSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdminPerformanceSummaryInputSchema = z.object({
  reportingPeriod: z
    .string()
    .describe('The period for which the summary is requested (e.g., "last month", "Q3 2023").'),
  totalStudents: z.number().describe('Total number of registered students.'),
  activeStudents: z.number().describe('Number of students currently active in courses.'),
  monthlyRevenue: z.number().describe('Total revenue generated in the reporting period.'),
  monthlyExpenses: z.number().describe('Total expenses incurred in the reporting period.'),
  netProfit: z.number().describe('Net profit for the reporting period (revenue - expenses).'),
  pendingPaymentsCount: z.number().describe('Number of outstanding payments from students.'),
  upcomingClassesCount: z
    .number()
    .describe('Number of driving classes scheduled in the near future.'),
  monthlyRevenueTrend: z
    .array(
      z.object({
        month: z.string().describe('Month name (e.g., "Jan", "Feb").'),
        revenue: z.number().describe('Revenue for that month.'),
      })
    )
    .describe('Array of monthly revenue data for trend analysis.'),
  monthlyProfitTrend: z
    .array(
      z.object({
        month: z.string().describe('Month name (e.g., "Jan", "Feb").'),
        profit: z.number().describe('Profit for that month.'),
      })
    )
    .describe('Array of monthly profit data for trend analysis.'),
  expenseBreakdown: z
    .array(
      z.object({
        category: z.string().describe('Expense category (e.g., Fuel, Salary, Maintenance).'),
        amount: z.number().describe('Amount spent in this category.'),
      })
    )
    .describe('Array of expense categories and their amounts for breakdown analysis.'),
});
export type AdminPerformanceSummaryInput = z.infer<typeof AdminPerformanceSummaryInputSchema>;

const AdminPerformanceSummaryOutputSchema = z.object({
  summary: z.string().describe("A natural language summary of the driving school's performance, including financial trends, student progress, and operational insights.")
});
export type AdminPerformanceSummaryOutput = z.infer<typeof AdminPerformanceSummaryOutputSchema>;

export async function getAdminPerformanceSummary(
  input: AdminPerformanceSummaryInput
): Promise<string> {
  const result = await adminPerformanceSummaryFlow(input);
  return result.summary;
}

const prompt = ai.definePrompt({
  name: 'adminPerformanceSummaryPrompt',
  input: {schema: AdminPerformanceSummaryInputSchema},
  output: {schema: AdminPerformanceSummaryOutputSchema},
  prompt: `You are an expert business analyst specializing in driving school operations. Your task is to analyze the provided data for the {{reportingPeriod}} and generate a concise, actionable performance summary for the school's administrator.

The summary should cover:
1.  **Overall Performance**: A high-level overview.
2.  **Financial Health**:
    -   Key figures: Monthly Revenue, Monthly Expenses, Net Profit.
    -   Pending Payments: Mention the count.
    -   Expense Breakdown: Summarize major expense categories.
    -   Trends: Analyze the 'monthlyRevenueTrend' and 'monthlyProfitTrend' to identify growth, decline, or stability.
3.  **Student Management**:
    -   Student base: Total students and active students.
    -   Suggest any insights or concerns related to student numbers.
4.  **Operational Insights**:
    -   Upcoming Classes: Mention the number.
    -   Identify potential operational bottlenecks or areas for efficiency based on the available data.
5.  **Actionable Recommendations**: Provide 2-3 specific, actionable suggestions based on your analysis to improve performance or address identified issues.

Use the following data:

**Reporting Period**: {{reportingPeriod}}
**Total Students**: {{totalStudents}}
**Active Students**: {{activeStudents}}
**Monthly Revenue**: ₹{{monthlyRevenue}}
**Monthly Expenses**: ₹{{monthlyExpenses}}
**Net Profit**: ₹{{netProfit}}
**Pending Payments**: {{pendingPaymentsCount}} outstanding payments.
**Upcoming Classes**: {{upcomingClassesCount}} scheduled classes.

**Monthly Revenue Trend**:
{{#each monthlyRevenueTrend}}
- {{this.month}}: ₹{{this.revenue}}
{{/each}}

**Monthly Profit Trend**:
{{#each monthlyProfitTrend}}
- {{this.month}}: ₹{{this.profit}}
{{/each}}

**Expense Breakdown**:
{{#each expenseBreakdown}}
- {{this.category}}: ₹{{this.amount}}
{{/each}}

Ensure the summary is professional, clear, and easy to understand for a administrator. Focus on providing value and actionable insights.`,
});

const adminPerformanceSummaryFlow = ai.defineFlow(
  {
    name: 'adminPerformanceSummaryFlow',
    inputSchema: AdminPerformanceSummaryInputSchema,
    outputSchema: AdminPerformanceSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI model failed to generate a response. Please try again.');
    }
    return output;
  }
);
