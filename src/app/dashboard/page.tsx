import AiSummary from "@/components/dashboard/ai-summary";
import { RevenueChart, ProfitChart, ExpensesChart } from "@/components/dashboard/charts";
import StatsCards from "@/components/dashboard/stats-cards";
import UpcomingClasses from "@/components/dashboard/upcoming-classes";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <StatsCards />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <ProfitChart />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
           <AiSummary />
        </div>
        <div className="lg:col-span-2">
          <ExpensesChart />
        </div>
      </div>
      <UpcomingClasses />
    </div>
  );
}
