'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from "~/trpc/react";
import UserMenu from '../_components/userIcon';
import BaseDropdown from '../_components/base/baseDropdown';
import Image from 'next/image';

type Base = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      void router.replace('/');
    }
  }, [session, status, router]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newBaseName, setNewBaseName] = useState('');
  const [editBaseName, setEditBaseName] = useState('');
  const [selectedBase, setSelectedBase] = useState<Base | null>(null);

  const { data: bases, refetch, isLoading } = api.base.getAll.useQuery();
  
  const createBase = api.base.create.useMutation({
    onSuccess: () => {
      void refetch();
      setModalOpen(false);
      setNewBaseName('');
    },
  });

  const editBase = api.base.edit.useMutation({
    onSuccess: () => {
      void refetch();
      setEditModalOpen(false);
      setEditBaseName('');
      setSelectedBase(null);
    },
  });

  const deleteBase = api.base.delete.useMutation({
    onSuccess: () => {
      void refetch();
      setDeleteModalOpen(false);
      setSelectedBase(null);
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

  const handleEditBase = async () => {
    if (!editBaseName.trim() || !selectedBase) return;
    try {
      await editBase.mutateAsync({ 
        id: selectedBase.id, 
        name: editBaseName.trim() 
      });
    } catch (error) {
      console.error("Failed to edit base:", error);
    }
  };

  const handleDeleteBase = async () => {
    if (!selectedBase) return;
    try {
      await deleteBase.mutateAsync({ id: selectedBase.id });
    } catch (error) {
      console.error("Failed to delete base:", error);
    }
  };

  const openEditModal = (base: Base) => {
    setSelectedBase(base);
    setEditBaseName(base.name);
    setEditModalOpen(true);
  };

  const openDeleteModal = (base: Base) => {
    setSelectedBase(base);
    setDeleteModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 py-2 shadow-sm">
        <div className="cursor-pointer" onClick={() => router.push("/")}>
          <Image src="/Airtable-Logo.svg" width={100} height={40} alt="Logo" />
        </div>
        <div className="relative">
          <UserMenu />
        </div>
      </header>

      {/* Body */}
      <section className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {bases?.map((base) => (
            <div
              key={base.id}
              className="relative flex h-32 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white text-center font-medium shadow-sm hover:shadow-md group"
            >
              {/* Base content */}
              <div 
                className="flex-1 h-full flex items-center justify-center px-2"
                onClick={() => router.push(`/base/${base.id}`)}
              >
                {base.name}
              </div>
              
              {/* Dropdown component */}
              <BaseDropdown 
                base={base}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
              />
            </div>
          ))}

          {/* Add Base Button */}
          {!isLoading && (
            <div
              onClick={() => setModalOpen(true)}
              className="flex h-32 flex-col items-center justify-center gap-1 rounded-md border-2 border-gray-400 bg-white p-2 text-sm text-black hover:text-blue-600 cursor-pointer"
            >
              <span className="text-2xl font-bold">＋</span>
              Add a base
            </div>
          )}
        </div>
      </section>

      {/* Create Base Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Create New Base</h2>
            <input
              type="text"
              value={newBaseName}
              onChange={(e) => setNewBaseName(e.target.value)}
              onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') await handleAddBase();
                if (e.key === 'Escape') setModalOpen(false);
              }}
              placeholder="Base name"
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded bg-gray-200 px-4 py-1 text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBase}
                disabled={createBase.isPending}
                className="rounded bg-blue-500 px-4 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {createBase.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Base Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Edit Base Name</h2>
            <input
              type="text"
              value={editBaseName}
              onChange={(e) => setEditBaseName(e.target.value)}
              onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') await handleEditBase();
                if (e.key === 'Escape') setEditModalOpen(false);
              }}
              placeholder="Base name"
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded bg-gray-200 px-4 py-1 text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEditBase}
                disabled={editBase.isPending}
                className="rounded bg-blue-500 px-4 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {editBase.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete Base</h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete "{selectedBase?.name}"? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="rounded bg-gray-200 px-4 py-1 text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBase}
                disabled={deleteBase.isPending}
                className="rounded bg-red-500 px-4 py-1 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteBase.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <Image src="/Airtable_Logo_blue.svg" className="h-10 w-10 animate-spin" width={100} height={100} alt="Logo" />
        </div>
      )}
    </main>
  );
}