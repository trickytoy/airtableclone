"use client"

import { useState, useRef, useEffect } from "react"
import { LogOut, User, Settings, HelpCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function UserMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { data: session } = useSession()

  const userInitial = session?.user?.name?.[0]?.toUpperCase() ?? "U"
  const userName = session?.user?.name ?? "User"
  const userEmail = session?.user?.email ?? ""

  const toggleMenu = () => setMenuOpen((prev) => !prev)

  const handleSignOut = async () => {
    void router.push("/api/auth/signout")
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="flex items-center justify-center rounded-full p-1 transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white font-semibold text-sm shadow-sm ring-2 ring-white/20 transition-transform duration-200 hover:scale-105">
          {userInitial}
        </div>
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
            {/* User Info Section */}
            <div className="px-4 py-3 border-b border-white">
              <div className="flex items-center gap-3">
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                  {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
                </div>
            </div>

            <div className="border-t ml-3 mr-3 border-gray-100" />

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  // Add your profile navigation logic here
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 bg:white hover:bg-gray-50 transition-colors duration-150"
              >
                <User className="h-4 w-4 text-gray-400" />
                View Profile
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  // Add your settings navigation logic here
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                Settings
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  // Add your help navigation logic here
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              >
                <HelpCircle className="h-4 w-4 text-gray-400" />
                Help & Support
              </button>
            </div>

            {/* Divider */}
            <div className="border-t ml-3 mr-3 border-gray-100" />

            {/* Sign Out */}
            <div className="py-1">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm  text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              >
                <LogOut className="h-4 w-4 text-gray-400" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
