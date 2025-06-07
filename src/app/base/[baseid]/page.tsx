"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { api } from "~/trpc/react"
import { Plus, X } from "lucide-react"
import UserMenu from "~/app/_components/userIcon"
import { CurrTable } from "~/app/_components/table/CurrTable"
import Image from "next/image"

export default function BasePage() {
  const router = useRouter()
  const params = useParams()
  const baseId = params?.baseid as string

  const { data: base, isLoading: baseLoading } = api.base.getById.useQuery({ id: baseId })
  const { data: tables, isLoading: tablesLoading, refetch: refetchTables } = api.table.getByBase.useQuery({ baseId })

  const createTableMutation = api.table.create.useMutation({
    onSuccess: () => {
      refetchTables()
        .then(() => setShowModal(false))
        .catch((error) => console.error("Failed to refetch tables:", error))
    },
  })

  const [showModal, setShowModal] = useState(false)
  const [newTableName, setNewTableName] = useState("")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return
    try {
      await createTableMutation.mutateAsync({ name: newTableName.trim(), baseId })
    } catch (error) {
      console.error("Failed to create table:", error)
    }
  }

  const handleSelectTable = (tableId: string) => {
    setSelectedTableId(tableId)
  }

  return (
    <div className="bg-[#f2f4f8] flex flex-col h-screen">
      <header className="flex items-center justify-between bg-[#166ee1] px-6 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/Airtable_Logo_small.svg"
            width={25}
            height={25}
            alt="Logo"
            onClick={() => router.push("/")}
            className="cursor-pointer"
          />
          <h1 className="text-white text-lg font-semibold">
            {baseLoading ? "Loading..." : base?.name ?? "Untitled Base"}
          </h1>
        </div>
        <div className="relative">
          <UserMenu />
        </div>
      </header>

      {/* Tables */}
      <div className="flex items-center justify-between bg-[#1464cc] px-6 py-0 text-sm text-white">
        <div className="flex gap-2 items-center">
          {tablesLoading ? (
            <span>Loading tables...</span>
          ) : (
            tables?.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => handleSelectTable(table.id)}
                className={`font-medium text-sm rounded-t-sm px-5 py-2 transition-colors ${
                  selectedTableId === table.id
                    ? "bg-white text-[#1464cc]"
                    : "bg-[#1464cc] text-white hover:bg-[#0f5bb8]"
                }`}
              >
                {table.name}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={createTableMutation.status === "pending"}
            className="text-white font-medium text-sm rounded-t-sm px-5 py-2 inline-flex items-center bg-[#1464cc] hover:bg-[#0f5bb8] disabled:opacity-50 transition-colors"
            title="Create New Table"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className="text-xs text-white">Hello</span>
      </div>

      {/* Pass selectedTableId to CurrTable */}
      <div className="flex-1 min-h-0 overflow-hidden">
          <CurrTable tableId={selectedTableId} />
      </div>
      

      {/* Modal */}
      {showModal && (
        <>
          {/* Overlay with blur */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"
            onClick={() => setShowModal(false)}
          />

          {/* Centered popup */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-md p-6 w-80 shadow-lg relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
              <h2 className="text-lg font-semibold mb-4">Create New Table</h2>
              <input
                type="text"
                placeholder="Table name"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateTable}
                disabled={newTableName.trim() === "" || createTableMutation.status === "pending"}
                className={`w-full py-2 rounded text-white ${
                  newTableName.trim() === "" || createTableMutation.status === "pending"
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {createTableMutation.status === "pending" ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
