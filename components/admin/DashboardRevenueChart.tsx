"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RevenuePoint = {
  label: string;
  amount: number;
};

export default function DashboardRevenueChart({
  data,
  locale,
}: {
  data: RevenuePoint[];
  locale: "fr" | "en";
}) {
  const en = locale === "en";
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(en ? "en-US" : "fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <section className="admin-panel admin-revenue-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>{en ? "Payments received" : "Encaissements reçus"}</h2>
          <p>{en ? "Actual payments recorded over the last 7 days." : "Paiements réellement enregistrés sur les 7 derniers jours."}</p>
        </div>
        <div className="admin-revenue-total">
          <span>{en ? "7-day total" : "Total sur 7 jours"}</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </div>
      {total === 0 ? (
        <div className="admin-chart-empty">
          <span>{en ? "No payments received during this period." : "Aucun encaissement enregistré sur cette période."}</span>
        </div>
      ) : (
        <div className="admin-revenue-chart" role="img" aria-label={en ? "Daily payments received over the last seven days" : "Encaissements quotidiens reçus sur les sept derniers jours"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 2, left: 4 }}>
              <CartesianGrid stroke="var(--admin-chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--admin-chart-label)", fontSize: 11 }}
                dy={9}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--admin-chart-label)", fontSize: 10 }}
                tickFormatter={(value: number) => new Intl.NumberFormat(en ? "en-US" : "fr-FR", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)}
                width={46}
              />
              <Tooltip
                formatter={(value) => [formatMoney(Number(value)), en ? "Received" : "Encaissé"]}
                contentStyle={{
                  border: "1px solid var(--admin-border)",
                  borderRadius: 10,
                  background: "var(--admin-surface)",
                  color: "var(--admin-text)",
                  boxShadow: "0 8px 24px rgb(16 24 39 / 10%)",
                }}
                labelStyle={{ color: "var(--admin-muted)", marginBottom: 4 }}
                cursor={{ stroke: "var(--admin-chart-grid)", strokeDasharray: "4 4" }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="var(--admin-accent)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--admin-surface)", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "var(--admin-accent)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="admin-chart-caption">
        {en ? "Amounts are based on confirmed order payments." : "Montants calculés à partir des paiements de commandes enregistrés."}
      </p>
    </section>
  );
}
