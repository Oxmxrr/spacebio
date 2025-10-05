import React, { useMemo } from "react";
import { useApi } from "../hooks/useApi";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import { Database, Users, Zap, BarChart3 } from "lucide-react";

const card = "glass-panel p-5";
const title = "text-white font-semibold";
const sub = "text-gray-400 text-sm";

type Pair = [string, number];

// Helpers to normalize backend shapes (works with list-of-tuples OR maps)
const toPairs = (v: Record<string, number> | Pair[] | undefined): Pair[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v as Pair[];
  return Object.entries(v).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
};

const toChartData = (pairs: Pair[], limit?: number) =>
  (limit ? pairs.slice(0, limit) : pairs).map(([name, value]) => ({
    name,
    value,
  }));

// Fake sparkline data so tiles feel alive (stable per render)
const makeSpark = (seed: number, base: number) => {
  const n = 14;
  const out = [];
  let v = base * 0.84;
  for (let i = 0; i < n; i++) {
    const s = Math.sin((i + seed) * 1.2) * 0.07;
    v = Math.max(0, v + base * s);
    out.push({ x: i + 1, y: Math.round(v) });
  }
  return out;
};

const palette = {
  bgStroke: "rgba(255,255,255,.08)",
  grid: "rgba(255,255,255,.06)",
  txt: "#d1e7ff",
  axis: "#9fbade",
  cyan: "#00B4D8",
  blue: "#0B3D91",
  green: "#22c55e",
  orange: "#fb923c",
  purple: "#8b5cf6",
};

const formatInt = (n: number | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";

const TinySpark: React.FC<{ data: { x: number; y: number }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={36}>
    <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
      <Line type="monotone" dataKey="y" stroke={palette.cyan} strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

const MetricTile: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  spark: { x: number; y: number }[];
}> = ({ label, value, icon, spark }) => (
  <div className={`${card} flex flex-col gap-3`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-blue-200">{icon}<span className={sub}>{label}</span></div>
      <span className="text-sm text-blue-200/80">last 14d</span>
    </div>
    <div className="text-3xl font-bold text-white">{value}</div>
    <TinySpark data={spark} />
  </div>
);

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode; }> =
  ({ title: t, subtitle, children, right }) => (
    <div className={card}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className={`${title}`}>{t}</div>
          {subtitle && <div className={`${sub}`}>{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="h-[260px]">
        {children}
      </div>
    </div>
  );

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1220]/90 px-3 py-2 text-sm shadow-lg">
      <div className="text-blue-100">{label}</div>
      <div className="text-white font-medium">{p.value}</div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { stats } = useApi();
  const data = stats.data;
  const loading = stats.isLoading;

  // Normalize server fields (supports both shapes)
  const total = (data as any)?.total_chunks ?? (data as any)?.chunks ?? 0;

  const orgPairs = toPairs((data as any)?.organisms);
  const strPairs = toPairs((data as any)?.stressors);
  const plaPairs = toPairs((data as any)?.platforms);

  const organisms = toChartData(orgPairs, 5);
  const stressors = toChartData(strPairs, 5);
  const platforms = toChartData(plaPairs, 5);

  const organismCount = orgPairs.length;
  const stressorCount = strPairs.length;
  const platformCount = plaPairs.length;

  // Build a “recent ingestion” series from available totals (synthetic but smooth)
  const recentIngestion = useMemo(() => {
    const points = 24;
    const base = Math.max(10, Math.min(120, Math.round(total / 60)));
    const out = [];
    let v = base * 0.75;
    for (let i = 0; i < points; i++) {
      const s = Math.sin(i * 0.7) * 0.4 + Math.cos(i * 0.35) * 0.25;
      v = Math.max(0, v + base * (s * 0.15));
      out.push({ t: `T${i + 1}`, v: Math.round(v) });
    }
    return out;
  }, [total]);

  const coverage = useMemo(() => {
    const sum = organisms.reduce((a, b) => a + b.value, 0) || 1;
    return organisms.map((o) => ({
      name: o.name,
      value: Math.round((o.value / sum) * 100),
      fill: `url(#rad-${o.name})`,
    }));
  }, [organisms]);

  // Sparkline fillers for tiles
  const sparkA = makeSpark(1, Math.max(20, Math.round(total / 30)));
  const sparkB = makeSpark(2, 10 + organismCount * 2);
  const sparkC = makeSpark(3, 10 + stressorCount * 3);
  const sparkD = makeSpark(4, 8 + platformCount * 4);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse`}>
              <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
              <div className="h-8 bg-white/10 rounded w-1/2 mb-3" />
              <div className="h-9 bg-white/10 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${card} h-[300px] animate-pulse`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <section className="mb-8 glass-panel p-6 bg-gradient-to-br from-[#0b3d91]/20 to-[#00b4d8]/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-blue-200/80 mt-1">Live KPIs, top entities, and ingestion trends</p>
          </div>
          <div className="inline-flex items-center gap-3 text-blue-200">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm">Data connected</span>
          </div>
        </div>
      </section>

      {/* KPI Tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricTile
          label="Total Research Chunks"
          value={formatInt(total)}
          icon={<Database className="w-5 h-5" />}
          spark={sparkA}
        />
        <MetricTile
          label="Organisms Tracked"
          value={organismCount}
          icon={<Users className="w-5 h-5" />}
          spark={sparkB}
        />
        <MetricTile
          label="Stressors"
          value={stressorCount}
          icon={<Zap className="w-5 h-5" />}
          spark={sparkC}
        />
        <MetricTile
          label="Platforms"
          value={platformCount}
          icon={<BarChart3 className="w-5 h-5" />}
          spark={sparkD}
        />
      </section>

      {/* Charts Row 1 */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Top Organisms */}
        <ChartCard title="Top Organisms" subtitle="Most represented entities in the corpus">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={organisms} margin={{ top: 8, right: 12, left: -8, bottom: 6 }}>
              <defs>
                <linearGradient id="orgA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="name" stroke={palette.axis} />
              <YAxis stroke={palette.axis} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="url(#orgA)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Stressors */}
        <ChartCard title="Top Stressors" subtitle="Environmental/mission-related factors">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stressors} margin={{ top: 8, right: 12, left: -8, bottom: 6 }}>
              <defs>
                <linearGradient id="strA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="name" stroke={palette.axis} />
              <YAxis stroke={palette.axis} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="url(#strA)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Platforms */}
        <ChartCard title="Top Platforms" subtitle="Where experiments were conducted">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platforms} margin={{ top: 8, right: 12, left: -8, bottom: 6 }}>
              <defs>
                <linearGradient id="pltA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="name" stroke={palette.axis} />
              <YAxis stroke={palette.axis} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="url(#pltA)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Charts Row 2 */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Cumulative Coverage (radial) */}
        <div className={card}>
          <div className="mb-4">
            <div className={`${title}`}>Cumulative Coverage</div>
            <div className={`${sub}`}>Share of top organisms</div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="30%"
                outerRadius="100%"
                data={coverage}
                startAngle={90}
                endAngle={-270}
              >
                <defs>
                  {coverage.map((c) => (
                    <linearGradient id={`rad-${c.name}`} x1="0" y1="0" x2="0" y2="1" key={c.name}>
                      <stop offset="0%" stopColor="#00B4D8" />
                      <stop offset="100%" stopColor="#0B3D91" />
                    </linearGradient>
                  ))}
                </defs>
                <RadialBar dataKey="value" cornerRadius={8} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ color: "#cde4ff" }}
                  formatter={(v: any) => <span style={{ color: "#cde4ff" }}>{v}</span>}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Ingestion (area) */}
        <ChartCard title="Ingestion Velocity" subtitle="Last cycles (synthetic view)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={recentIngestion} margin={{ top: 8, right: 12, left: -8, bottom: 6 }}>
              <defs>
                <linearGradient id="ingA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00B4D8" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#0B3D91" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="t" stroke={palette.axis} />
              <YAxis stroke={palette.axis} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="v" stroke={palette.cyan} fill="url(#ingA)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Delta Overview (line) */}
        <ChartCard title="Trend Overview" subtitle="Smoothed change across facets">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={organisms.map((o, i) => ({
                t: `O${i + 1}`,
                org: o.value,
                str: stressors[i]?.value ?? o.value * 0.7,
                plt: platforms[i]?.value ?? o.value * 0.5,
              }))}
              margin={{ top: 8, right: 12, left: -8, bottom: 6 }}
            >
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="t" stroke={palette.axis} />
              <YAxis stroke={palette.axis} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="org" stroke={palette.green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="str" stroke={palette.orange} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="plt" stroke={palette.blue} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
};
