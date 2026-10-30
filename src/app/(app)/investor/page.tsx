import { redirect } from "next/navigation";

// The investor dashboard moved to "/" (Update Pack 1.1); its content lives in YourProjects.
export default function InvestorDashboardRedirect() {
  redirect("/");
}
