import Link from "next/link";
import { Card } from "./ui";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-semibold text-brand-900">
          SitePilot <span className="text-brand-600">AI</span>
        </Link>
        <Card className="p-6">
          <h1 className="mb-5 text-xl font-semibold">{title}</h1>
          {children}
        </Card>
        {footer ? <div className="mt-4 text-center text-sm text-slate-600">{footer}</div> : null}
      </div>
    </main>
  );
}
