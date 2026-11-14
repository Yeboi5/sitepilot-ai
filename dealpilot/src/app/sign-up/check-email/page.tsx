import Link from "next/link";

export const metadata = { title: "Check your email" };

export default function CheckEmail() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Check your email</h1>
      <p className="mt-3 text-slate-600">
        If that address can be registered, we&apos;ve sent a confirmation link to it. Open the link on this device to activate your account.
      </p>
      <p className="mt-6 text-sm"><Link className="text-brand-700 underline" href="/sign-in">Back to sign in</Link></p>
    </div>
  );
}
