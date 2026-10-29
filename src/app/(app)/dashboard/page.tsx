import { redirect } from "next/navigation";
import { homePathFor, requireOrg } from "@/lib/session";

export default async function DashboardRedirect() {
  const ctx = await requireOrg();
  redirect(homePathFor(ctx.active.organisation.type));
}
