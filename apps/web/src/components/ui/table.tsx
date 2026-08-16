import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The presentational table shell. It carries no data behaviour — sorting,
 * filtering and links stay with the feature component — so it renders in jsdom
 * and every consumer's test keeps working on accessible roles.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="w-full overflow-x-auto rounded-lg border border-border bg-card"
    >
      <table data-slot="table" className={cn("w-full text-meta", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "border-b border-border bg-muted/50 text-left text-label text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:nth-child(even)]:bg-muted/25", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors duration-(--duration-fast) last:border-0 hover:bg-accent/60 has-[a:focus-visible]:bg-accent/60",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("px-4 py-2.5 font-semibold tracking-wide whitespace-nowrap", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td data-slot="table-cell" className={cn("px-4 py-3 align-middle", className)} {...props} />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("px-4 py-2 text-left text-meta text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow };
