"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Plus,
  Eye,
  EyeOff,
  Filter,
  ArrowUpDown,
  Palette,
  Search,
  Grid3X3,
  Settings,
  Calendar,
  ImageIcon,
  Trello,
  Check,
  CirclePlus,
  Loader2,
  FileText,
  GanttChart,
  List,
  PlusSquare,
} from "lucide-react";
//import TableView from "../base/Table";
import { FilterPopup } from "../base/filterPopup";
import { SortPopup } from "../base/sortPopup";
import { HideFieldsPopup } from "../base/HideFieldsPopup";
import { ViewPopup } from "../base/ViewPopup";
import { api } from "~/trpc/react";
import TableView from "../base/Table";

type CurrTableProps = {
  tableId?: string | null;
};

type FilterCondition = {
  id: string;
  columnId: string;
  operator: "is" | "is not" | "contains" | "does not contain" | "is empty" | "is not empty" | "=" | "!=" | ">" | "<";
  value: string;
};

type SortCriteria = {
  id: string;
  columnId: string;
  direction: "asc" | "desc";
};

type ViewData = {
  filters: FilterCondition[];
  sortCriteria: SortCriteria[];
  hiddenColumns: string[];
};

type View = {
  id: string;
  viewName: string;
  viewData: ViewData;
};

export function CurrTable({ tableId }: CurrTableProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isHideFieldsOpen, setIsHideFieldsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [activeSorts, setActiveSorts] = useState<SortCriteria[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [viewsOpen, setViewsOpen] = useState(true);
  const [isViewPopupOpen, setIsViewPopupOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [views, setViews] = useState<View[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Ref to track if we're currently applying a view to prevent update loops
  const isApplyingViewRef = useRef(false);
  const lastViewUpdateRef = useRef<string | null>(null);

  const utils = api.useUtils();

  // Fetch existing views when tableId changes
  const viewsQuery = api.views.getAllForTable.useQuery(
    tableId!,
    { enabled: !!tableId }
  );

  // Update view mutation
  const updateViewMutation = api.views.update.useMutation({
    onSuccess: async (updatedView) => {
      // Update the view in local state
      setViews(prev => prev.map(view => 
        view.id === updatedView.id 
          ? {
              id: updatedView.id,
              viewName: updatedView.viewName,
              viewData: updatedView.viewData as ViewData,
            }
          : view
      ));
      
      // Optionally invalidate the views query to keep data in sync
      if (tableId) {
        await utils.views.getAllForTable.invalidate(tableId);
      }
    },
    onError: (error) => {
      console.error('Failed to update view:', error);
    },
  });

  // Load persisted activeViewId from localStorage when tableId changes
  useEffect(() => {
    if (tableId) {
      const savedViewId = localStorage.getItem(`activeView_${tableId}`);
      if (savedViewId) {
        setActiveViewId(savedViewId);
      }
    }
  }, [tableId]);

  // Save activeViewId to localStorage whenever it changes
  useEffect(() => {
    if (tableId && activeViewId) {
      localStorage.setItem(`activeView_${tableId}`, activeViewId);
    } else if (tableId && activeViewId === null) {
      localStorage.removeItem(`activeView_${tableId}`);
    }
  }, [tableId, activeViewId]);

  // Update views state when query data changes
  useEffect(() => {
    if (viewsQuery.data) {
      const convertedViews: View[] = viewsQuery.data.map((view) => ({
        id: view.id,
        viewName: view.viewName,
        viewData: view.viewData as ViewData,
      }));
      setViews(convertedViews);
      
      // If we have a saved activeViewId, apply that view
      if (activeViewId && !isApplyingViewRef.current) {
        const savedView = convertedViews.find(v => v.id === activeViewId);
        if (savedView) {
          isApplyingViewRef.current = true;
          setActiveFilters(savedView.viewData.filters);
          setActiveSorts(savedView.viewData.sortCriteria);
          setHiddenColumns(savedView.viewData.hiddenColumns);
          // Reset the flag after a brief delay
        }
      }
    }
  }, [viewsQuery.data, activeViewId]);

  // Auto-save view data when filters, sorts, or hidden columns change
  useEffect(() => {
    // Don't auto-save if we're currently applying a view or if there's no active view
    if (isApplyingViewRef.current || !activeViewId || !tableId) {
      return;
    }

    // Create a unique key for this update to prevent duplicate saves
    const updateKey = `${activeViewId}_${JSON.stringify({
      filters: activeFilters,
      sortCriteria: activeSorts,
      hiddenColumns: hiddenColumns,
    })}`;

    // Don't save if this is the same update we just made
    if (lastViewUpdateRef.current === updateKey) {
      return;
    }

    lastViewUpdateRef.current = updateKey;

    // Debounce the save operation
      updateViewMutation.mutate({
        viewId: activeViewId,
        viewData: {
          filters: activeFilters,
          sortCriteria: activeSorts,
          hiddenColumns: hiddenColumns,
        },
      });

  }, [activeFilters, activeSorts, hiddenColumns, activeViewId, tableId, updateViewMutation]);

  const deleteAllMutation = api.utils.deleteAllRowsAndCellsByTable.useMutation({
    onSuccess: async () => {
      if (!tableId) return;
      await utils.row.getRows.reset({ tableId });
      await utils.row.getRows.invalidate({ 
        tableId, 
        limit: 50 
      });
      await utils.row.count.reset({ tableId });
      await utils.row.count.invalidate({ 
        tableId, 
      });
    },
    onError: (error) => {
      console.error('Failed to delete all rows:', error);
      // Optionally show error to user
    },
  });

  const generateTableMutation = api.utils.generateLargeTable.useMutation({
    onSuccess: async () => {
      if (!tableId) return;
      await utils.row.getRows.reset({ tableId });
      await utils.row.getRows.invalidate({ 
        tableId, 
        limit: 50 
      });
      await utils.row.count.reset({ tableId });
      await utils.row.count.invalidate({ 
        tableId, 
      });
    },
    onError: (error) => {
      console.error('Failed to generate table:', error);
      // Optionally show error to user
    },
  });

  const createViewMutation = api.views.create.useMutation({
    onSuccess: async (newView) => {
      // Convert the database response to match your View type
      const convertedView: View = {
        id: newView.id,
        viewName: newView.viewName,
        viewData: newView.viewData as ViewData,
      };
      
      setViews(prev => [...prev, convertedView]);
      
      // Optionally invalidate the views query to keep data in sync
      if (tableId) {
        await utils.views.getAllForTable.invalidate(tableId);
      }
    },
    onError: (error) => {
      console.error('Failed to create view:', error);
      // Optionally show error message to the user
    },
  });

  const addView = async (viewName: string) => {
    if (!tableId || !viewName.trim()) return;
    
    try {
      await createViewMutation.mutateAsync({
        tableId: tableId,
        viewName: viewName.trim(),
        filters: activeFilters,
        sortCriteria: activeSorts,
        hiddenColumns: hiddenColumns,
      });
      // Close the popup on success
      setIsViewPopupOpen(false);
    } catch (error) {
      console.error('Failed to create view:', error);
      // Error is already handled in the mutation's onError
    }
  };

  const applyView = (view: View) => {
    isApplyingViewRef.current = true;
    setActiveFilters(view.viewData.filters);
    setActiveSorts(view.viewData.sortCriteria);
    setHiddenColumns(view.viewData.hiddenColumns);
    setActiveViewId(view.id);
    
    // Reset the flag after a brief delay
    isApplyingViewRef.current = false;
  };

  const isLoading = deleteAllMutation.isPending || generateTableMutation.isPending;
  const isDisabled = isLoading || !tableId;

  const columns = api.column.getByTable.useQuery(
    { tableId: tableId ?? "" },
    { enabled: !!tableId }
  );

  const add100K = async () => {
    if (!tableId) return;
    try {
      const simplified = columns?.data?.map(({ id, type }) => ({
        Column_id: id,
        Column_type: type,
      })) || [];
      await generateTableMutation.mutateAsync({ tableId, count: 1000,  columns: simplified, });
    } catch (error) {
      // Error is handled in the mutation's onError
    }
  };

  const add1K = async () => {
    if (!tableId) return;
    try {
      const simplified = columns?.data?.map(({ id, type }) => ({
        Column_id: id,
        Column_type: type,
      })) || [];
      await generateTableMutation.mutateAsync({ tableId, count: 1000,  columns: simplified, });
    } catch (error) {
      // Error is handled in the mutation's onError
    }
  };

  const deleteAll = async () => {
    if (!tableId) return;
    try {
      await deleteAllMutation.mutateAsync({ tableId });
    } catch (error) {
      // Error is handled in the mutation's onError
      console.log("delete all error")
    }
  };

  const handleApplyFilters = (filters: FilterCondition[]) => {
    setActiveFilters(filters);
    // Don't clear active view - let it auto-save
    //console.log("Applied filters:", filters);
  };

  const handleCloseFilter = () => {
    setIsFilterOpen(false);
  };

  const handleApplySort = (sorts: SortCriteria[]) => {
    setActiveSorts(sorts);
    // Don't clear active view - let it auto-save
    console.log("Applied sorts:", sorts);
  };

  const handleCloseSort = () => {
    setIsSortOpen(false);
  };

  const handleApplyHideFields = (hiddenColumnIds: string[]) => {
    setHiddenColumns(hiddenColumnIds);
    // Don't clear active view - let it auto-save
    console.log("Hidden columns:", hiddenColumnIds);
  };

  const handleCloseHideFields = () => {
    setIsHideFieldsOpen(false);
  };

  // Clear active view function for when user wants to start fresh
  const clearActiveView = () => {
    setActiveViewId(null);
    setActiveFilters([]);
    setActiveSorts([]);
    setHiddenColumns([]);
    if (tableId) {
      localStorage.removeItem(`activeView_${tableId}`);
    }
  };

  //console.log(columns.data)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
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
            
            <div className="relative">
              <button 
                className={`flex items-center space-x-1 text-sm ${
                  isDisabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => !isDisabled && setIsViewPopupOpen(true)}
                disabled={isDisabled}
              >
                <Grid3X3 className="w-4 h-4" />
                <span>Add view</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              <ViewPopup
                isOpen={isViewPopupOpen}
                onClose={() => setIsViewPopupOpen(false)}
                onAdd={addView}
              />
            </div>

            {/* Clear View Button */}
            {activeViewId && (
              <button 
                className={`flex items-center space-x-1 text-sm ${
                  isDisabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => !isDisabled && clearActiveView()}
                disabled={isDisabled}
                title="Clear active view"
              >
                <span>Clear view</span>
              </button>
            )}

            {/* Hide Fields Button with Popup */}
            <div className="relative">
              <button 
                className={`flex items-center space-x-1 text-sm ${
                  isDisabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : hiddenColumns.length > 0
                    ? 'text-blue-600 hover:text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => !isDisabled && setIsHideFieldsOpen(!isHideFieldsOpen)}
                disabled={isDisabled}
              >
                <EyeOff className="w-4 h-4" />
                <span>Hide fields</span>
                {hiddenColumns.length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {hiddenColumns.length}
                  </span>
                )}
              </button>

              <HideFieldsPopup
                isOpen={isHideFieldsOpen}
                onClose={handleCloseHideFields}
                onApply={handleApplyHideFields}
                columns={columns.data ?? []}
                initialHiddenColumns={hiddenColumns}
              />
            </div>

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
                onClose={handleCloseFilter}
                onApply={handleApplyFilters}
                columns={columns.data ?? []}
                initialFilters={activeFilters} // Add this line
              />
            </div>

            {/* Sort Button with Popup */}
            <div className="relative">
              <button 
                className={`flex items-center space-x-1 text-sm ${
                  isDisabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : activeSorts.length > 0
                    ? 'text-blue-600 hover:text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => !isDisabled && setIsSortOpen(!isSortOpen)}
                disabled={isDisabled}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>Sort</span>
                {activeSorts.length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {activeSorts.length}
                  </span>
                )}
              </button>

              <SortPopup
                isOpen={isSortOpen}
                onClose={handleCloseSort}
                onApply={handleApplySort}
                columns={columns.data ?? []}
                initialSorts={activeSorts}
              />
            </div>

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

            <button 
              className={`flex items-center space-x-1 text-sm ${
                isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => !isDisabled && add1K()}
              disabled={isDisabled}
            >
              {generateTableMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CirclePlus className="w-4 h-4" />
              )}
              <span>Add 1K Rows</span>
            </button>
          </div>

          <div
            className={`relative w-full max-w-sm ${
              isDisabled ? 'cursor-not-allowed' : ''
            }`}
          >
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                isDisabled ? 'text-gray-300' : 'text-gray-400'
              }`}
              size={16}
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isDisabled}
              className={`pl-9 pr-3 py-1.5 text-sm rounded-md w-full transition-colors
                ${isDisabled
                  ? 'bg-gray-100 border border-gray-200 text-gray-400 placeholder:text-gray-300'
                  : 'border border-gray-300 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 hover:border-gray-400'}
              `}
            />
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
              {viewsQuery.isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : views.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No views yet
                </div>
              ) : (
                views.map((view) => (
                  <div
                    key={view.id}
                    className={`flex items-center justify-between px-2 py-2 rounded group mb-1 cursor-pointer ${
                      isDisabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : activeViewId === view.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => !isDisabled && applyView(view)}
                  >
                    <div className="flex items-center">
                      <Grid3X3 className="w-4 h-4 mr-2" />
                      <span className="text-sm">{view.viewName}</span>
                      {updateViewMutation.isPending && activeViewId === view.id && (
                        <Loader2 className="w-3 h-3 animate-spin ml-2 text-gray-400" />
                      )}
                    </div>
                    {activeViewId === view.id && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Create Section */}
            <div className="border-t ml-2 mr-2 border-gray-200">
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm font-medium text-gray-700">Create...</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>

                {/* View Types */}
                <div className="mt-1 space-y-1">
                  {/* Grid */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Grid3X3 className="w-4 h-4 text-blue-500 mr-2 " />
                      <span className="text-sm text-gray-700">Grid</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4 " />
                    </button>
                  </div>

                  {/* Calendar */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-[#D54401] mr-2" />
                      <span className="text-sm text-gray-700">Calendar</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Gallery */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <ImageIcon className="w-4 h-4 text-[#9965F0] mr-2" />
                      <span className="text-sm text-gray-700">Gallery</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Kanban */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <Trello className="w-4 h-4 text-green-700 mr-2" />
                      <span className="text-sm text-gray-700">Kanban</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>


                  {/* List */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <List className="w-4 h-4 text-blue-900 mr-2" />
                      <span className="text-sm text-gray-700">List</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Gantt */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <GanttChart className="w-4 h-4 text-teal-800 mr-2" />
                      <span className="text-sm text-gray-700">Gantt</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* New section */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-700">New section</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Team</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border-t ml-2 mr-2 border-gray-200"></div>

                  {/* Form */}
                  <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 rounded group">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">Form</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-grow overflow-y-auto">
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
            <TableView 
               tableId={tableId} 
               filters={activeFilters} 
               sorts={activeSorts}
               hiddenColumns={hiddenColumns}
               search={searchTerm}
            />
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