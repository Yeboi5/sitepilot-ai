import { BUSINESS_NAV, Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("business");
  return <Shell user={user} nav={BUSINESS_NAV} portal="Business">{children}</Shell>;
}
