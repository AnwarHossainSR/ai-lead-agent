import { ArrowRightIcon, BuildingIcon, SendIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { Fact } from "@/components/fact";
import { Panel } from "@/components/panel";
import { Card, CardEyebrow } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface CountResponse {
  readonly count: number;
}

/**
 * Fetches one stat's count and renders it through `<Fact>`. A Server
 * Component passed as a Client Component's children (design D1) — the
 * fetch, and its degraded/unreachable conditions, run on the server.
 */
async function StatCount({ path }: { path: string }) {
  const url = apiUrl(path);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<CountResponse>(url);

  if (result.status !== "ok") {
    return (
      <span title={result.error}>
        <Fact fact={{ certainty: "unknown" }} />
      </span>
    );
  }

  return (
    <Fact fact={{ certainty: "observed", value: result.data.count }} format={(value) => value} />
  );
}

/**
 * The queue the operator is here for. It leads the page because approving or
 * rejecting a drafted message is the one thing on this dashboard that only a
 * person can do — every other number is context for it.
 */
function ReviewQueueCard({ path, index }: { path: string; index: number }) {
  return (
    <Card
      rail="observed"
      tone="warning"
      interactive
      data-enter
      style={{ "--enter-index": index } as React.CSSProperties}
      className="justify-between gap-6 p-6 sm:col-span-2 sm:row-span-2"
    >
      <div className="flex flex-col gap-1">
        <CardEyebrow>Waiting on you</CardEyebrow>
        <h2 className="text-base font-semibold">Messages awaiting review</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing is sent until a person approves it. Each draft carries the facts it cites, so you
          can check a claim before it goes out.
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <p data-numeric className="text-6xl leading-none font-bold text-warning">
          <Panel title="Awaiting review" fallback={<Skeleton className="h-14 w-24" />}>
            <StatCount path={path} />
          </Panel>
        </p>

        <Link
          href="/outreach/review"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-all duration-(--duration-fast) outline-none hover:border-ring/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open the queue
          <ArrowRightIcon
            className="size-4 transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </Card>
  );
}

function StatCard({
  title,
  path,
  icon,
  caption,
  index,
}: {
  title: string;
  path: string;
  icon: React.ReactNode;
  caption: string;
  index: number;
}) {
  return (
    <Card
      rail="observed"
      tone="primary"
      interactive
      data-enter
      style={{ "--enter-index": index } as React.CSSProperties}
      className="gap-3 p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <CardEyebrow>{title}</CardEyebrow>
        <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      </div>

      <p data-numeric className="text-3xl leading-none font-semibold">
        <Panel title={title} fallback={<Skeleton className="h-8 w-14" />}>
          <StatCount path={path} />
        </Panel>
      </p>

      <p className="text-xs text-muted-foreground">{caption}</p>
    </Card>
  );
}

export default function Home() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Where the pipeline stands, and what is waiting on a decision."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReviewQueueCard path="/outreach/count?status=pending_approval" index={0} />

        <StatCard
          index={1}
          title="Companies"
          path="/companies/count"
          icon={<BuildingIcon />}
          caption="Discovered and kept"
        />
        <StatCard
          index={2}
          title="Active leads"
          path="/leads/count?active=true"
          icon={<UsersIcon />}
          caption="Scored and still open"
        />
        <StatCard
          index={3}
          title="Sent this week"
          path={`/outreach/count?status=sent&sentAfter=${encodeURIComponent(sevenDaysAgo)}`}
          icon={<SendIcon />}
          caption="Approved and recorded as sent"
        />
      </div>
    </div>
  );
}
