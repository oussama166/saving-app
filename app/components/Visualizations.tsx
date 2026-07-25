"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface VisualizationsProps {
  data: {
    expensesByCategory: { name: string; value: number }[];
    budgetVsActual: { category: string; budget: number; actual: number }[];
  };
}

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
];

export default function Visualizations({ data }: VisualizationsProps) {
  return (
    // dir="ltr" forcé : le SVG des graphiques (barres, camembert, axes) ne
    // doit pas se mettre en miroir en arabe. Sans ça, `text-anchor="end"`
    // sur les axes se comporte comme une valeur logique CSS et bascule de
    // sens sous `dir="rtl"` hérité de <html>, ce qui repositionne les
    // labels hors du cadre — même bug de débordement que le fix précédent,
    // mais déclenché uniquement en arabe.
    <div dir="ltr" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Donut Chart */}
      <div className="bg-surface-alt/50 border border-line p-6 rounded-2xl h-[400px] flex flex-col">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">
          Expenses by Category
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.expensesByCategory}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={5}
              dataKey="value"
            >
              {data.expensesByCategory.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                borderColor: "#334155",
                color: "#f1f5f9",
              }}
              itemStyle={{ color: "#f1f5f9" }}
            />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart */}
      <div className="bg-surface-alt/50 border border-line p-6 rounded-2xl h-[400px] flex flex-col">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">
          Budget vs Actual
        </h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart
            data={data.budgetVsActual}
            margin={{ top: 5, right: 10, left: 0, bottom: 30 }}
          >
            <XAxis
              dataKey="category"
              stroke="#94a3b8"
              fontSize={8}
              tickLine={false}
              axisLine={false}
              angle={-30}
              textAnchor="end"
              interval={0}
              height={50}
              tickMargin={8}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={8}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value} DH`}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "#334155", opacity: 0.4 }}
              contentStyle={{
                backgroundColor: "#1e293b",
                borderColor: "#334155",
                color: "#f1f5f9",
              }}
            />
            <Legend verticalAlign="top" height={20} />
            <Bar
              dataKey="budget"
              name="Budget"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="actual"
              name="Spent"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
