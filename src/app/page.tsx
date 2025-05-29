import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/home"); // change to "/dashboard" if that's your actual home
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-900">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold">Sign in to Airtable</h1>
            <p className="text-sm text-gray-600">
              Use your work email to continue
            </p>
          </div>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p>
              {session ? (
                <span>
                  Signed in as <strong>{session.user?.email}</strong>
                </span>
              ) : (
                <span>Not signed in</span>
              )}
            </p>
            <Link
              href={session ? "/api/auth/signout" : "/api/auth/signin"}
              className="mt-2 inline-block text-blue-600 hover:underline"
            >
              {session ? "Sign out" : "Sign in with provider"}
            </Link>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
