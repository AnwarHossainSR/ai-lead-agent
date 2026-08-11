export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to MELA — AI-assisted B2B lead generation
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Companies" value="—" />
        <Card title="Contacts" value="—" />
        <Card title="Active Leads" value="—" />
        <Card title="Outreach" value="—" />
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Getting Started</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is the application shell. The dashboard will display key metrics
          and recent activity once the API integration is complete.
        </p>
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
