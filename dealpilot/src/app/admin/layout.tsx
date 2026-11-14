import { ADMIN_NAV, Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("admin");
  return <Shell user={user} nav={ADMIN_NAV} portal="Admin">{children}</Shell>;
}
