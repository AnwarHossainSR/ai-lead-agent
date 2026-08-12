import { type HealthStatus, getHealthStatus } from "@/lib/health";

function StatusBadge({ status }: { status: HealthStatus["status"] }) {
  const colors = {
    healthy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    degraded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    unreachable: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {status === "healthy" && "Healthy"}
      {status === "degraded" && "Degraded"}
      {status === "unreachable" && "Unreachable"}
    </span>
  );
}

function DependencyStatus({ name, status }: { name: string; status?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{name}</span>
      <span
        className={`text-sm font-medium ${status === "up" ? "text-green-600" : "text-red-600"}`}
      >
        {status === "up" ? "Up" : "Down"}
      </span>
    </div>
  );
}

export default async function Home() {
  const health = await getHealthStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to MELA — AI-assisted B2B lead generation</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Companies" value="—" />
        <Card title="Contacts" value="—" />
        <Card title="Active Leads" value="—" />
        <Card title="Outreach" value="—" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API Status</h2>
          <StatusBadge status={health.status} />
        </div>
        {health.error && <p className="mt-2 text-sm text-muted-foreground">{health.error}</p>}
        {(health.postgres || health.redis) && (
          <div className="mt-4 space-y-2">
            <DependencyStatus name="PostgreSQL" status={health.postgres} />
            <DependencyStatus name="Redis" status={health.redis} />
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
