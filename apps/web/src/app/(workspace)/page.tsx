import { Fact, type FactValue } from "@/components/fact";

function StatCard({ title, fact }: { title: string; fact: FactValue<number> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">
        <Fact fact={fact} />
      </p>
    </div>
  );
}

export default function Home() {
  const unknown: FactValue<number> = { certainty: "unknown" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to MELA — AI-assisted B2B lead generation</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Companies" fact={unknown} />
        <StatCard title="Active Leads" fact={unknown} />
        <StatCard title="Awaiting Review" fact={unknown} />
        <StatCard title="Sent This Week" fact={unknown} />
      </div>
    </div>
  );
}
