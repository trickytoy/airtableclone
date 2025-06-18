"use client"
// Add these state variables and functions to your BasePage component

// Add these imports if not already present
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { api } from "~/trpc/react"
import { Bell, ChevronDown, DropletIcon, HelpCircle, Plus, Redo2, Share, Undo2, X } from "lucide-react"
import UserMenu from "~/app/_components/userIcon"
import { CurrTable } from "~/app/_components/table/CurrTable"
import Image from "next/image"
import TableDropdown from "~/app/_components/table/TableDropdown"

// Add these type definitions if not already present
type Table = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  baseId: string;
};

type Base = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

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

  // Existing state
  const [showModal, setShowModal] = useState(false)
  const [newTableName, setNewTableName] = useState("")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  // Add these new state variables for table editing/deleting
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [editTableName, setEditTableName] = useState("")
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const baseQuery = api.base.getById.useQuery({ id: baseId });
  const setLastOpenedTable = api.base.setLastOpenedTable.useMutation();
  // Add these mutations for editing and deleting tables
  const updateTableMutation = api.table.edit.useMutation({
    onSuccess: () => {
      refetchTables()
        .then(() => {
          setEditModalOpen(false)
          setSelectedTable(null)
          setEditTableName("")
        })
        .catch((error) => console.error("Failed to refetch tables:", error))
    },
  })

  const deleteTableMutation = api.table.delete.useMutation({
    onSuccess: () => {
      refetchTables()
        .then(() => {
          setDeleteModalOpen(false)
          setSelectedTable(null)
          // If the deleted table was selected, clear the selection
          if (selectedTable && selectedTableId === selectedTable.id) {
            setSelectedTableId(null)
          }
        })
        .catch((error) => console.error("Failed to refetch tables:", error))
    },
  })

  // Fixed useEffect - removed selectedTableId from dependencies to prevent infinite loop
  useEffect(() => {
    if (baseLoading || tablesLoading) {
      return; // Don't do anything while still loading
    }
    if (baseQuery.data?.lastOpenedTableId && !selectedTableId) {
      setSelectedTableId(baseQuery.data.lastOpenedTableId);
    } else if (tables && tables.length > 0 && !selectedTableId) {
      const firstTable = tables[0];
      if (firstTable) { // This check explicitly tells TypeScript firstTable is not undefined
        setSelectedTableId(firstTable.id);
      }
    }
  }, [baseQuery.data?.lastOpenedTableId, tables]); // Removed selectedTableId from dependencies

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return
    try {
      await createTableMutation.mutateAsync({ name: newTableName.trim(), baseId })
    } catch (error) {
      console.error("Failed to create table:", error)
    }
  }

  const handleSelectTable = async (tableId: string) => {
    setSelectedTableId(tableId);
    await setLastOpenedTable.mutateAsync({
      baseId,
      tableId,
    });
  };

  // Add these new handler functions
  const openEditModal = (table: Table) => {
    setSelectedTable(table);
    setEditTableName(table.name);
    setEditModalOpen(true);
  };

  const openDeleteModal = (table: Table) => {
    setSelectedTable(table);
    setDeleteModalOpen(true);
  };

  const handleEditTable = async () => {
    if (!selectedTable || !editTableName.trim()) return
    try {
      await updateTableMutation.mutateAsync({ 
        id: selectedTable.id, 
        name: editTableName.trim() 
      })
    } catch (error) {
      console.error("Failed to edit table:", error)
    }
  }

  const handleDeleteTable = async () => {
    if (!selectedTable) return
    try {
      await deleteTableMutation.mutateAsync({ id: selectedTable.id })
    } catch (error) {
      console.error("Failed to delete table:", error)
    }
  }

  return (
    <div className="bg-[#f2f4f8] flex flex-col h-screen">
<header className="flex items-center justify-between bg-[#166ee1] px-6 py-2 shadow-sm">
        {/* Left section - Logo, Base name, and Navigation */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/Airtable_Logo_small.svg"
              width={25}
              height={25}
              alt="Logo"
              onClick={() => router.push("/")}
              className="cursor-pointer"
            />
            <div className="flex items-center gap-1">
              <h1 className="text-white text-lg font-semibold">
                {baseLoading ? "Loading..." : (base?.name ?? "Untitled Base")}
              </h1>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-6">
            <button className="text-white text-sm font-small bg-[#135EBF] pl-2 pr-2 pt-1 pb-1 rounded-2xl hover:text-white/80 transition-colors">
            Data</button>
            <button className="text-white/80 text-sm font-small hover:text-white/80 transition-colors">
              Automations
            </button>
            <button className="text-white/80 text-sm font-small hover:text-white/80 transition-colors">
            Interfaces</button>

            {/* Vertical divider */}
            <div className="w-px h-4 bg-white/30" />

            <button className="text-white/80 text-sm font-small hover:text-white/80 transition-colors">Forms</button>
          </nav>
        </div>

        {/* Right section - Action buttons and User menu */}
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-md text-white hover:bg-white/10 transition-colors duration-150 opacity-50"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-white text-sm hover:bg-white/10 transition-colors duration-150">
            <HelpCircle className="h-4 w-4" />
            Help
          </button>

          <button className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 text-[#166ee1] text-sm hover:bg-white/100 transition-colors duration-150 font-medium">
            <Share className="h-4 w-4" />
            Share
          </button>

          <button
            className="relative p-2 rounded-4xl text-[#166ee1] bg-white/95 hover:bg-white/100 transition-colors duration-150"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            
          </button>

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
              <div 
                key={table.id}
                className={`font-medium flex items-center text-sm rounded-t-sm pl-3 pr-3 py-1  ${
                  selectedTableId === table.id
                    ? "bg-white text-black"
                    : "bg-[#1464cc] text-white hover:bg-[#0f5bb8]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectTable(table.id)}
                >
                  {table.name}
                </button>

                {selectedTableId === table.id && (
                  <TableDropdown 
                    table={table}
                    onEdit={openEditModal}
                    onDelete={openDeleteModal}
                  />
                )}
              </div>
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

      {/* Create Table Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-40"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-md p-6 w-80 relative">
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

      {/* Edit Table Modal */}
      {editModalOpen && selectedTable && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-40"
            onClick={() => setEditModalOpen(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-md p-6 w-80 relative">
              <button
                onClick={() => setEditModalOpen(false)}
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
              <h2 className="text-lg font-semibold mb-4">Edit Table</h2>
              <input
                type="text"
                placeholder="Table name"
                value={editTableName}
                onChange={(e) => setEditTableName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleEditTable}
                disabled={editTableName.trim() === "" || updateTableMutation.status === "pending"}
                className={`w-full py-2 rounded text-white ${
                  editTableName.trim() === "" || updateTableMutation.status === "pending"
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {updateTableMutation.status === "pending" ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Table Modal */}
      {deleteModalOpen && selectedTable && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-40"
            onClick={() => setDeleteModalOpen(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-md p-6 w-80 relative">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
              <h2 className="text-lg font-semibold mb-4">Delete Table</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete "{selectedTable.name}"? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 py-2 rounded text-gray-600 bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTable}
                  disabled={deleteTableMutation.status === "pending"}
                  className={`flex-1 py-2 rounded text-white ${
                    deleteTableMutation.status === "pending"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {deleteTableMutation.status === "pending" ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}