import { CUSTOMER_NAV, Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("customer");
  return <Shell user={user} nav={CUSTOMER_NAV} portal="Customer">{children}</Shell>;
}
