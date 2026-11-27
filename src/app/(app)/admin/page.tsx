import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { PageHeader } from "@/components/layout/page-header";
import { ADMIN_SECTIONS } from "@/components/layout/nav-links";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  await requireUser("admin");
  return (
    <>
      <PageHeader index="Administración" title="Administración" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {ADMIN_SECTIONS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 rounded-lg border bg-card px-4 transition-colors hover:bg-muted/50">
              <Icon className="size-4 text-muted-foreground" /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
