'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogOut, UserCircle } from 'lucide-react';
import { api } from "~/trpc/react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load
    if (!session) {
      void router.replace('/'); // Redirect if not signed in
    }
  }, [session, status, router]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [addingBase, setAddingBase] = useState(false);
  const [newBaseName, setNewBaseName] = useState("");

  const { data: bases, refetch } = api.base.getAll.useQuery();
  const createBase = api.base.create.useMutation({
    onSuccess: () => {
      void refetch();
      setAddingBase(false);
      setNewBaseName("");
    },
  });

  const handleAddBase = async () => {
    if (!newBaseName.trim()) return;
    try {
      await createBase.mutateAsync({ name: newBaseName.trim() });
    } catch (error) {
      console.error("Failed to create base:", error);
    }
  };

  const handleSignOut = async () => {
    void router.push('/api/auth/signout');
  };

  const toggleMenu = () => setMenuOpen(prev => !prev);

  if (!session) {
    // Optionally render nothing while redirecting
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 py-2 shadow-sm">
        <h1 className="text-2xl font-bold text-black-600">Airtable</h1>
        <div className="relative">
          <button
            onClick={toggleMenu}
            className="flex items-center gap-2 rounded-full p-1 hover:bg-blue-100"
          >
            <UserCircle className="w-9 h-9 text-black-600" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-md border bg-white shadow-md z-10">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <section className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {bases?.map((base) => (
            <div
              key={base.id}
              className="flex h-32 items-center justify-center rounded-md border border-blue-300 bg-white text-center font-medium shadow-sm hover:shadow-md"
            >
              {base.name}
            </div>
          ))}

          {/* Add Base Input or Button */}
          <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-md border-2 border-blue-400 bg-white p-2 text-sm text-black hover:border-blue-600 hover:text-blue-600">
            {addingBase ? (
              <>
                <input
                  type="text"
                  value={newBaseName}
                  onChange={(e) => setNewBaseName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAddBase();
                    if (e.key === 'Escape') {
                      setAddingBase(false);
                      setNewBaseName("");
                    }
                  }}
                  placeholder="Base name"
                  className="w-full rounded border px-2 py-1 text-sm"
                  autoFocus
                />
                <button
                  onClick={() => void handleAddBase()}
                  className="mt-1 rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
                >
                  Create
                </button>
              </>
            ) : (
              <button
                onClick={() => setAddingBase(true)}
                className="flex flex-col items-center justify-center gap-1"
              >
                <span className="text-2xl font-bold">＋</span>
                Add a base
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
