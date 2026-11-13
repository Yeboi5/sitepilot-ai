import Link from "next/link";
import { IDS } from "@/lib/store/seed";

export const metadata = { title: "Demo journeys" };

const J = [
  {
    n: 1, title: "Upload a $5,500 fencing quote and receive competing bids", as: "Alex (customer)",
    steps: [
      ["Open the analysed demo quote", `/app/documents/${IDS.docFence}`],
      ["See the fencing request and compare three bids (two simulated, one from Ben's demo business)", `/app/requests/${IDS.reqFence}`],
      ["Or upload your own quote and create a new request with simulated bids", "/app/documents"],
    ],
  },
  {
    n: 2, title: "Negotiate a $120/month internet bill", as: "Alex (customer)",
    steps: [
      ["Open the negotiation — an AI draft is waiting for your approval", `/app/negotiations/${IDS.negInternet}`],
      ["Approve → the simulated provider counters → click “Prepare next step” → approve again", `/app/negotiations/${IDS.negInternet}`],
      ["Try Advisory or Limited Autopilot via AI permissions", "/app/settings"],
    ],
  },
  {
    n: 3, title: "Monitor a retail purchase for a price drop", as: "Alex (customer)",
    steps: [
      ["Open the price monitor and click “Simulate feed update” on the headphones", `/app/monitor#${IDS.watchHeadphones}`],
      ["Claim the price adjustment, then verify the refund amount", "/app/monitor"],
    ],
  },
  {
    n: 4, title: "Combine demand to unlock a group offer", as: "Alex (customer)",
    steps: [
      ["Join the Sydney solar bulk buy — your membership unlocks the 5-member tier", `/app/groups/${IDS.grpSolar}`],
      ["Add simulated neighbours to unlock the 10-member tier, then take up the deal", `/app/groups/${IDS.grpSolar}`],
      ["As Ben, publish a volume offer to the Elm Street fencing group", "/biz/groups"],
    ],
  },
  {
    n: 5, title: "A business receives a request and submits a counteroffer", as: "Ben (business)",
    steps: [
      ["See matching customer requests (customer identity hidden)", "/biz/requests"],
      ["Open the negotiation inbox — Alex asked for $4,600. Draft a counter with AI, approve and send", `/biz/inbox/${IDS.negFence}`],
    ],
  },
  {
    n: 6, title: "Approve a negotiated deal and record verified savings", as: "Alex, then Ben, then Alex",
    steps: [
      ["As Alex, open the fence negotiation, prepare a response to Ben's counter and approve it", `/app/negotiations/${IDS.negFence}`],
      ["As Ben, accept Alex's price", `/biz/inbox/${IDS.negFence}`],
      ["As Alex, confirm the final invoice amount to verify the saving — the $1.50 success fee is recorded (simulated, not charged)", "/app/savings"],
    ],
  },
];

export default function Journeys() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-brand-700">← DealPilot</Link>
      <h1 className="mt-2 text-3xl font-bold">Demo journeys</h1>
      <p className="mt-2 text-slate-600">
        All six required journeys run on fictional seeded data. Sign in with a demo account on the <Link className="text-brand-700 underline" href="/sign-in">sign-in page</Link> (one click), then follow the links.
        An admin can reset everything from the <Link href="/admin" className="text-brand-700 underline">audit page</Link>.
      </p>
      <ol className="mt-6 space-y-4">
        {J.map((j) => (
          <li key={j.n} className="card">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white">{j.n}</span>
              <div>
                <h2 className="font-semibold">{j.title}</h2>
                <p className="text-xs text-slate-500">Sign in as {j.as}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {j.steps.map(([label, href]) => <li key={label}><Link className="text-brand-700 hover:underline" href={href}>{label}</Link></li>)}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
