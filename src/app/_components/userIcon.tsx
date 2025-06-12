"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function UserMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  const userInitial = session?.user?.name?.[0]?.toUpperCase() ?? "U";

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleSignOut = async () => {
    void router.push("/api/auth/signout");
  };

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className="flex items-center gap-2 rounded-full p-0.5 bg-gray-100 hover:bg-gray-400"
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-white font-semibold text-sm">
          {userInitial}
        </div>
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
  );
}
