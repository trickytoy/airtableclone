"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  Plus,
  Eye,
  EyeOff,
  Filter,
  Group,
  ArrowUpDown,
  Palette,
  Search,
  Grid3X3,
  Settings,
  Calendar,
  ImageIcon,
  Trello,
  Timer,
  List,
  GanttChart,
  PlusSquare,
  FileText,
  Check,
  CirclePlus,
  Loader2,
} from "lucide-react";
import TableView from "../base/Table";
import { FilterPopup } from "../base/filterPopup"; // Import the FilterPopup component
import { api } from "~/trpc/react";

type CurrTableProps = {
  tableId?: string | null;
};

type FilterCondition = {
  id: string
  field: string
  operator: string
  value: string
}

export function CurrTable({ tableId }: CurrTableProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([])
  const [viewsOpen, setViewsOpen] = useState(true);
  const utils = api.useUtils();
  
  const deleteAllMutation = api.utils.deleteAllRowsAndCellsByTable.useMutation({
    onSuccess: async () => {
      // Reset the infinite query completely
      await utils.row.getByTable.reset({ tableId: tableId! });
      // Or use invalidate with the exact same parameters as the query
      await utils.row.getByTable.invalidate({ 
        tableId: tableId!, 
        limit: 50 
      });
    },
  });

  const generateTableMutation = api.utils.generateLargeTable.useMutation({
    onSuccess: async () => {
      await utils.row.getByTable.reset({ tableId: tableId! });
      // Or invalidate with exact parameters
      await utils.row.getByTable.invalidate({ 
        tableId: tableId!, 
        limit: 50 
      });
    },
  });

  // Check if any mutation is loading or if tableId is null/undefined
  const isLoading = deleteAllMutation.isPending || generateTableMutation.isPending;
  const isDisabled = isLoading || !tableId;

  const add100K = async () => {
    if (!tableId) return;
    await generateTableMutation.mutateAsync({ tableId: tableId, count: 100 });
  };

  const deleteAll = async () => {
    if (!tableId) return;
    await deleteAllMutation.mutateAsync({ tableId: tableId });
  }

  const handleApplyFilters = (filters: FilterCondition[]) => {
    setActiveFilters(filters)
    console.log("Applied filters:", filters)
    // Here you would typically pass the filters to your TableView component
    // or use them to filter your data query
  }

  const handleCloseFilter = () => {
    setIsFilterOpen(false)
  }

  // Example fields - you might want to get these from your table schema
  const columns = api.column.getByTable.useQuery({ tableId: tableId ?? "" });
  console.log(columns.data)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => !isDisabled && setViewsOpen(!viewsOpen)}
              disabled={isDisabled}
            >
              <Eye className="w-4 h-4" />
              <span>Views</span>
            </button>

            <div className="h-4 w-px bg-gray-300"></div>

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={isDisabled}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Grid view</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={isDisabled}
            >
              <EyeOff className="w-4 h-4" />
              <span>Hide fields</span>
            </button>

            {/* Filter Button with Popup */}
            <div className="relative">
              <button 
                className={`flex items-center space-x-1 text-sm ${
                  isDisabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : activeFilters.length > 0
                    ? 'text-blue-600 hover:text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => !isDisabled && setIsFilterOpen(!isFilterOpen)}
                disabled={isDisabled}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                {activeFilters.length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {activeFilters.length}
                  </span>
                )}
              </button>

              <FilterPopup
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                onApply={(filters) => {
                  console.log("Applied Filters:", filters)
                }}
                columns={columns.data ?? []}
              />
            </div>

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={isDisabled}
            >
              <Group className="w-4 h-4" />
              <span>Group</span>
            </button>

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              disabled={isDisabled}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>Sort</span>
            </button>

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => !isDisabled && deleteAll()}
              disabled={isDisabled}
            >
              {deleteAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Palette className="w-4 h-4" />
              )}
              <span>Delete All Rows</span>
            </button>

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => !isDisabled && add100K()}
              disabled={isDisabled}
            >
              {generateTableMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CirclePlus className="w-4 h-4" />
              )}
              <span>Add 100K Rows</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        {viewsOpen && (
          <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
            {/* Search */}
            <div className="p-2 border-b border-gray-200">
              <div className="flex items-center bg-gray-100 rounded px-2 py-1">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Find a view"
                  className={`bg-transparent border-none text-sm w-full focus:outline-none ${
                    isDisabled ? 'text-gray-400 cursor-not-allowed' : ''
                  }`}
                  disabled={isDisabled}
                />
                <button 
                  className={`${
                    isDisabled 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  disabled={isDisabled}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Views */}
            <div className="flex-1 overflow-y-auto p-1">
              <div className={`flex items-center justify-between px-2 py-2 rounded group ${
                isDisabled 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-blue-50 text-blue-600'
              }`}>
                <div className="flex items-center">
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  <span className="text-sm">Grid view</span>
                </div>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Create Section */}
            <div className="border-t border-gray-200 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className={`text-sm font-medium ${
                  isDisabled ? 'text-gray-400' : 'text-gray-700'
                }`}>Create...</span>
                <ChevronDown className={`w-4 h-4 ${
                  isDisabled ? 'text-gray-300' : 'text-gray-400'
                }`} />
              </div>

              {/* View Types */}
              <div className="space-y-1">
                {[
                  { icon: Grid3X3, label: "Grid" },
                  { icon: Calendar, label: "Calendar" },
                  { icon: ImageIcon, label: "Gallery" },
                  { icon: Trello, label: "Kanban" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between px-2 py-1 rounded group ${
                      isDisabled 
                        ? 'cursor-not-allowed' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-4 h-4 mr-2 ${
                        isDisabled ? 'text-gray-300' : 'text-gray-500'
                      }`} />
                      <span className={`text-sm ${
                        isDisabled ? 'text-gray-400' : 'text-gray-700'
                      }`}>{label}</span>
                    </div>
                    <button 
                      className={`${
                        isDisabled 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      disabled={isDisabled}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-lg text-gray-600 mb-2">
                  {deleteAllMutation.isPending ? 'Deleting all rows...' : 'Adding rows...'}
                </p>
                <p className="text-sm text-gray-500">This may take a moment</p>
              </div>
            </div>
          ) : tableId ? (
            <TableView tableId={tableId} />
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-gray-500">
              <div className="text-center">
                <p className="text-lg">Please select a table</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}