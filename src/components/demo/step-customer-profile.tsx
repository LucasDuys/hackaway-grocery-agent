"use client";

import { motion } from "motion/react";
import { useState, useEffect, useMemo } from "react";
import mockOrders from "@/data/mock-orders.json";

interface StepCustomerProfileProps {
  isActive: boolean;
}

interface OrderSummary {
  date: string;
  items: number;
  total: string;
}

function computeStats() {
  const sorted = [...mockOrders].sort(
    (a, b) => b.delivery_time - a.delivery_time
  );

  // Last 8 orders
  const last8: OrderSummary[] = sorted.slice(0, 8).map((o) => {
    const d = new Date(o.delivery_time);
    const date = d.toISOString().split("T")[0];
    const items = o.items.reduce((s, i) => s + i.quantity, 0);
    const total = (
      o.items.reduce((s, i) => s + i.price * i.quantity, 0) / 100
    ).toFixed(2);
    return { date, items, total };
  });

  // Average basket
  const totals = mockOrders.map(
    (o) => o.items.reduce((s, i) => s + i.price * i.quantity, 0) / 100
  );
  const avgBasket = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(
    2
  );

  // Average items per order
  const itemCounts = mockOrders.map((o) =>
    o.items.reduce((s, i) => s + i.quantity, 0)
  );
  const avgItems = Math.round(
    itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length
  );

  // Unique products
  const uniqueProducts = new Set<string>();
  mockOrders.forEach((o) =>
    o.items.forEach((i) => uniqueProducts.add(i.selling_unit_id))
  );

  // Favorite day
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayCounts: Record<string, number> = {};
  mockOrders.forEach((o) => {
    const d = new Date(o.delivery_time).getDay();
    dayCounts[days[d]] = (dayCounts[days[d]] || 0) + 1;
  });
  const favoriteDay = Object.entries(dayCounts).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  // Top 5 products by frequency
  const prodFreq: Record<string, number> = {};
  mockOrders.forEach((o) =>
    o.items.forEach((i) => {
      prodFreq[i.name] = (prodFreq[i.name] || 0) + 1;
    })
  );
  const top5 = Object.entries(prodFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    last8,
    avgBasket,
    avgItems,
    uniqueProducts: uniqueProducts.size,
    favoriteDay,
    top5,
    totalOrders: mockOrders.length,
  };
}

export function StepCustomerProfile({ isActive }: StepCustomerProfileProps) {
  const [phase, setPhase] = useState(0);
  const stats = useMemo(() => computeStats(), []);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive]);

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Step 1
      </p>
      <h2 className="mb-8 text-center text-5xl font-bold text-[var(--text-primary)]">
        Meet our customer
      </h2>

      <div className="flex max-w-5xl w-full gap-8">
        {/* Left: profile card */}
        <motion.div
          className="w-80 shrink-0 rounded-2xl bg-[var(--surface)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden"
          initial={{ opacity: 0, x: -30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ duration: 0.5 }}
        >
          {/* Red header */}
          <div className="bg-[var(--picnic-red)] px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="2" />
                  <path
                    d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-white">Weekly shopper</p>
                <p className="text-sm text-white/80">Member since March 2024</p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
            <div className="bg-[var(--surface)] p-4 text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.totalOrders}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Total orders</p>
            </div>
            <div className="bg-[var(--surface)] p-4 text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.favoriteDay}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Favorite day</p>
            </div>
            <div className="bg-[var(--surface)] p-4 text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                EUR {stats.avgBasket}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Avg basket</p>
            </div>
            <div className="bg-[var(--surface)] p-4 text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.avgItems}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Avg items</p>
            </div>
          </div>

          {/* Top 5 products */}
          <motion.div
            className="p-5"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Most purchased
            </p>
            <div className="flex flex-col gap-2">
              {stats.top5.map((p, i) => (
                <motion.div
                  key={p.name}
                  className="flex items-center justify-between text-sm"
                  initial={{ opacity: 0, x: -10 }}
                  animate={
                    phase >= 2
                      ? { opacity: 1, x: 0 }
                      : { opacity: 0, x: -10 }
                  }
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <span className="text-[var(--text-primary)] truncate mr-2">
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--picnic-red)]">
                    {p.count}x
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Right: order history table */}
        <motion.div
          className="flex-1 rounded-2xl bg-[var(--surface)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden"
          initial={{ opacity: 0, x: 30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Recent order history
            </p>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-[var(--text-muted)]">
                  Items
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-[var(--text-muted)]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.last8.map((order, i) => (
                <motion.tr
                  key={order.date}
                  className="border-b border-[var(--border)] last:border-b-0"
                  initial={{ opacity: 0, y: 8 }}
                  animate={
                    phase >= 2
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 8 }
                  }
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                >
                  <td className="px-6 py-3 text-base font-medium text-[var(--text-primary)]">
                    {order.date}
                  </td>
                  <td className="px-6 py-3 text-right text-base text-[var(--text-secondary)]">
                    {order.items}
                  </td>
                  <td className="px-6 py-3 text-right text-base font-semibold text-[var(--text-primary)]">
                    EUR {order.total}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>

      {/* Summary line */}
      <motion.p
        className="mt-8 text-center text-lg text-[var(--text-secondary)]"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        2 years of purchase history -- {stats.uniqueProducts} unique products,{" "}
        {stats.avgItems} items per order on average
      </motion.p>
    </motion.div>
  );
}
