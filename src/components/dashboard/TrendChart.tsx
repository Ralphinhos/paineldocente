import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/types/dashboard";

export default function TrendChart({ data }: { data: DashboardData["trend"] }) {
  const points = data.map((item) => ({ ...item, label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(item.generatedAt)) }));
  return <div className="chart-frame" aria-label="Evolução de casos críticos e de atenção"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: -20 }}><CartesianGrid stroke="#e7edf3" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#607086", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#607086", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: "1px solid #d7e0e9", borderRadius: 10, boxShadow: "0 8px 24px rgba(7,29,53,.09)" }} /><Legend iconType="circle" iconSize={8} /><Line name="Críticos" type="monotone" dataKey="critical" stroke="#b42318" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /><Line name="Atenção" type="monotone" dataKey="attention" stroke="#b54708" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>;
}
