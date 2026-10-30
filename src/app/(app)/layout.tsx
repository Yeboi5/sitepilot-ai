import { AppShell } from "@/components/shell/app-shell";
import { requireOrg } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
