import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className={cn("relative w-full overflow-x-auto rounded-lg border bg-card", className)}>
      <table className="w-full caption-bottom text-sm" {...props} />
    </div>
  );
}
const TableHeader = (p: React.ComponentProps<"thead">) => <thead className={cn("[&_tr]:border-b", p.className)} {...p} />;
const TableBody = (p: React.ComponentProps<"tbody">) => <tbody className={cn("[&_tr:last-child]:border-0", p.className)} {...p} />;
const TableRow = (p: React.ComponentProps<"tr">) => (
  <tr className={cn("border-b transition-colors hover:bg-muted/50", p.className)} {...p} />
);
const TableHead = (p: React.ComponentProps<"th">) => (
  <th className={cn("h-10 px-3 text-left align-middle font-mono text-xs font-normal whitespace-nowrap text-muted-foreground", p.className)} {...p} />
);
const TableCell = (p: React.ComponentProps<"td">) => (
  <td className={cn("p-3 align-middle whitespace-nowrap", p.className)} {...p} />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
