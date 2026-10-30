import { AppShell } from "@/components/shell/app-shell";
import { getSessionContext } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Pages guests can browse (Update Pack 1.1). Signed-in users see the same pages with their account. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
