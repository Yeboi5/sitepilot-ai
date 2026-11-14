import Link from "next/link";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { AbnBadge, VerificationBadge } from "@/components/verification-badges";
import { requireUser } from "@/lib/auth/session";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listBusinessesForAdmin } from "@/lib/services/verification";

export const metadata = { title: "Business verification" };

export default async function AdminBusinesses({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("admin");
  const list = await listBusinessesForAdmin(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Business verification" subtitle="Pending reviews first. Every decision is audit-logged." />
      <Flash error={f.error} notice={f.notice} />
      <ul className="space-y-2">
        {list.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/businesses/${b.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-brand-300">
              <span className="font-medium">{b.name}</span>
              <span className="flex flex-wrap gap-1"><VerificationBadge status={b.verificationStatus} /><AbnBadge status={b.abnStatus} />{b.statusReason?.startsWith("Fictional") && <Badge tone="amber">Demo</Badge>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
