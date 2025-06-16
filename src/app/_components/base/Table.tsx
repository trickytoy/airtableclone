// TableView.tsx
"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { Loader2, Edit, Check, X, PlusIcon } from "lucide-react"
import { api } from "~/trpc/react"
import { EditableCell } from "./Cell" // Assuming EditableCell is in ./Cell
import React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useQueryClient } from "@tanstack/react-query"
import { faker } from '@faker-js/faker'

type Column = {
  id: string
  name: string
  type: "TEXT" | "NUMBER"
}

type CellValue = {
  id: string
  createdAt: Date
  updatedAt: Date
  rowId: string
  columnId: string
  textValue: string | null
  numberValue: number | null
}

type Row = {
  id: string
  createdAt: Date
  cellValuesByColumnId: Record<string, CellValue>
}

type FilterCondition = {
  id: string
  columnId: string
  operator: "is" | "is not" | "contains" | "does not contain" | "is empty" | "is not empty" | "=" | "!=" | ">" | "<"
  value: string
}

type SortCriteria = {
  id: string
  columnId: string
  direction: "asc" | "desc"
}

type TableViewProps = {
  tableId?: string | null
  filters?: FilterCondition[]
  sorts?: SortCriteria[]
  hiddenColumns?: string[]
  search?: string // Make search optional as per default in component
}

export default function TableView({
  tableId,
  filters = [],
  sorts = [],
  hiddenColumns = [],
  search = ""
}: TableViewProps) {
  console.log(tableId)
  const queryClient = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // State for columns, initialized from API call
  const [columnsState, setColumnsState] = useState<Column[]>([])
  const [isInitializingSampleData, setIsInitializingSampleData] = useState(false)

  // ADD THIS: Local state for fast updates
  const [localFlatData, setLocalFlatData] = useState<Row[]>([]);

  // Track which column is being edited
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnName, setEditingColumnName] = useState<string>("")

  // ADD THIS: State for new column dialog
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "NUMBER">("TEXT")

  // TRPC Queries and Mutations
  const columnQuery = api.column.getByTable.useQuery({ tableId: tableId ?? "" });
  const upsertCellValue = api.cellValue.upsert.useMutation({});
  const editColumn = api.column.edit.useMutation({
    onSuccess: () => {
      // Refetch columns after successful edit
      void columnQuery.refetch();
      setEditingColumnId(null);
      setEditingColumnName("");
    },
  });
  
  const addColumnMutation = api.column.create.useMutation({
    onSuccess: () => {
      // Refetch columns after successful add
      void columnQuery.refetch();
      setNewColumnName("");
      setNewColumnType("TEXT");
      setIsAddColumnDialogOpen(false);
    },
  });
  const addRowMutation = api.row.create.useMutation()

  // NEW: Batch mutations for initializing sample data
  const createMultipleColumnsMutation = api.column.createMultiple?.useMutation?.({
    onSuccess: () => {
      void columnQuery.refetch();
    },
  });
  
  const createMultipleRowsMutation = api.row.createMultiple?.useMutation?.({
    onSuccess: () => {
      void refetch(); // Add optional chaining here
      void countRefetch();
    },
  });

  // Fetch rows for the visible range
  const {
    data: rowQuery,
    fetchNextPage,
    isFetchingNextPage,
    isLoading: isLoadingRows,
    error,
    refetch
  } = api.row.getRows.useInfiniteQuery(
    {
      tableId: tableId ?? "",
      limit: 200,
      filters: filters,
      sorts: sorts,
      search: search,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!tableId && !!columnQuery.data, // Only enabled if tableId exists and columns are fetched
    }
  );

  const { data: countData, refetch: countRefetch } = api.row.count.useQuery({ tableId: tableId ?? "" });
  const totalDBRowCount = countData?.total ?? 0;

  // NEW: Function to generate sample columns with faker data
  const generateSampleColumns = useCallback(() => {
    const sampleColumns = [
      { name: "Name", type: "TEXT" as const },
      { name: "Notes", type: "TEXT" as const },
      { name: "Value", type: "NUMBER" as const }
    ];
    
    return sampleColumns.map((col, index) => ({
      name: col.name,
      type: col.type,
      position: index,
      tableId: tableId!
    }));
  }, [tableId]);

  // NEW: Function to generate sample rows with faker data
  const generateSampleRows = useCallback((columns: Column[], count = 5) => {
    const rows = [];
    
    for (let i = 0; i < count; i++) {
      const rowData: any = {
        tableId: tableId!,
        cellValues: columns.map(col => ({
          columnId: col.id,
          textValue: col.type === "TEXT" ? faker.helpers.arrayElement([
            faker.person.firstName(),
          ]) : null,
          numberValue: col.type === "NUMBER" ? faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }) : null
        }))
      };
      rows.push(rowData);
    }
    
    return rows;
  }, [tableId]);

  // NEW: Initialize sample data when no columns exist
  const initializeSampleData = useCallback(async () => {
    if (!tableId || isInitializingSampleData) return;
    
    setIsInitializingSampleData(true);
    
    try {
      // First, create sample columns
      const sampleColumnsData = generateSampleColumns();
      
      // If we have batch mutations available, use them
      if (createMultipleColumnsMutation) {
        await createMultipleColumnsMutation.mutateAsync(sampleColumnsData);
      } else {
        // Fallback to individual column creation
        for (const columnData of sampleColumnsData) {
          await addColumnMutation.mutateAsync(columnData);
        }
      }
      
      // Wait a bit for columns to be created and refetched
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the newly created columns
      const { data: newColumns } = await columnQuery.refetch();
      
      if (newColumns && newColumns.length > 0) {
        const mappedColumns = newColumns.map(col => ({
          id: col.id,
          name: col.name,
          type: col.type as "TEXT" | "NUMBER"
        }));
        
        // Generate sample rows
        const sampleRowsData = generateSampleRows(mappedColumns, 5);
        
        // Create sample rows
        if (createMultipleRowsMutation) {
          await createMultipleRowsMutation.mutateAsync(sampleRowsData);
        } else {
          // Fallback to individual row creation
          for (const rowData of sampleRowsData) {
            const newRow = await addRowMutation.mutateAsync({
              tableId: tableId,
            });
            
            // Create cell values for the new row
            for (const cellData of rowData.cellValues) {
              await upsertCellValue.mutateAsync({
                rowId: newRow.id,
                columnId: cellData.columnId,
                textValue: cellData.textValue,
                numberValue: cellData.numberValue,
              });
            }
          }
        }
      }
      
    } catch (error) {
      console.error("Failed to initialize sample data:", error);
    } finally {
      setIsInitializingSampleData(false);
    }
  }, [
    tableId, 
    isInitializingSampleData, 
    generateSampleColumns, 
    generateSampleRows,
    createMultipleColumnsMutation,
    createMultipleRowsMutation,
    addColumnMutation,
    addRowMutation,
    upsertCellValue,
    columnQuery
  ]);

  // Update columnsState when column data is fetched
  useEffect(() => {
    if (columnQuery.data) {
      setColumnsState(columnQuery.data.map(col => ({
        id: col.id,
        name: col.name,
        type: col.type,
      })));
    }
  }, [columnQuery.data]);

  // NEW: Check if we need to initialize sample data
  useEffect(() => {
    if (
      tableId && 
      columnQuery.data !== undefined && 
      columnQuery.data.length === 0 && 
      !isInitializingSampleData
    ) {
      initializeSampleData();
    }
  }, [tableId, columnQuery.data, isInitializingSampleData, initializeSampleData]);

  // CHANGE THIS: Server data for syncing
  const serverFlatData = useMemo(
    () => rowQuery?.pages.flatMap(page => page.formattedRows) ?? [],
    [rowQuery?.pages]
  );

  // ADD THIS: Sync server data to local state when it changes
  useEffect(() => {
    setLocalFlatData(serverFlatData);
  }, [serverFlatData]);

  // Handle edit column button click
  const handleEditColumn = useCallback((column: Column) => {
    setEditingColumnId(column.id);
    setEditingColumnName(column.name);
  }, []);

  // Handle save column name
  const handleSaveColumnName = useCallback(async (columnId: string, newName: string) => {
    if (!newName.trim()) return;

    const column = columnsState.find(col => col.id === columnId);
    if (!column) return;

    try {
      await editColumn.mutateAsync({
        id: columnId,
        name: newName.trim(),
        type: column.type,
        position: columnsState.findIndex(col => col.id === columnId), // Pass current position
      });
    } catch (error) {
      console.error("Failed to update column name:", error);
    }
  }, [columnsState, editColumn]);

  // Handle cancel column edit
  const handleCancelColumnEdit = useCallback(() => {
    setEditingColumnId(null);
    setEditingColumnName("");
  }, []);

  // CHANGE THIS: Updated saveEdit with fast local updates
  // CHANGE THIS: Updated saveEdit with fast local updates and proper null/undefined handling
  const saveEdit = useCallback(async (rowId: string, columnId: string, editValue: string) => {
    const column = columnsState.find((col) => col.id === columnId);
    if (!column) return;

    const isNumberColumn = column.type === "NUMBER";
    const isTextColumn = column.type === "TEXT";

    const numValue = isNumberColumn
      ? editValue === "" || isNaN(Number(editValue))
        ? null
        : Number.parseFloat(editValue)
      : null;

    const textValue = isTextColumn ? editValue : null;

    // Immediate UI update
    setLocalFlatData(prev => prev.map(row => {
      if (row.id === rowId) {
        const existingCell = row.cellValuesByColumnId[columnId];
        return {
          ...row,
          cellValuesByColumnId: {
            ...row.cellValuesByColumnId,
            [columnId]: {
              ...existingCell,
              id: existingCell?.id ?? `temp-${rowId}-${columnId}`, // Fallback for new cells
              createdAt: existingCell?.createdAt ?? new Date(),
              updatedAt: new Date(),
              rowId,
              columnId,
              textValue,
              numberValue: numValue,
            }
          }
        };
      }
      return row;
    }));

    try {
      // Background server update - convert null to undefined for TRPC
      await upsertCellValue.mutateAsync({
        rowId,
        columnId,
        textValue: textValue ?? undefined, // Convert null to undefined
        numberValue: numValue ?? undefined, // Convert null to undefined
      });
      // No need for refetch - the useEffect above will sync when React Query updates
    } catch (error) {
      // Revert on error by re-syncing with server data
      setLocalFlatData(serverFlatData);
      console.error("Failed to save cell edit", error);
      throw error;
    }
  }, [columnsState, upsertCellValue, serverFlatData]);

  // Filter out hidden columns and map columns for react-table
  const visibleColumns = useMemo(() => {
    return columnsState.filter(col => !hiddenColumns.includes(col.id));
  }, [columnsState, hiddenColumns]);

  const columns: ColumnDef<Row, string | number | null>[] = useMemo(
    () => visibleColumns.map((col) => ({
      id: col.id,
      header: () => (
        <div className="flex items-center justify-between w-full group">
          {editingColumnId === col.id ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editingColumnName}
                onChange={(e) => setEditingColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveColumnName(col.id, editingColumnName);
                  } else if (e.key === 'Escape') {
                    handleCancelColumnEdit();
                  }
                }}
                className="flex-1 px-1 py-0 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={() => handleSaveColumnName(col.id, editingColumnName)}
                className="p-1 rounded hover:bg-gray-200 flex-shrink-0"
                title="Save"
              >
                <Check className="h-3 w-3 text-green-600" />
              </button>
              <button
                onClick={handleCancelColumnEdit}
                className="p-1 rounded hover:bg-gray-200 flex-shrink-0"
                title="Cancel"
              >
                <X className="h-3 w-3 text-red-600" />
              </button>
            </div>
          ) : (
            <>
              <span className="truncate flex-1">{col.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditColumn(col);
                }}
                className="ml-2 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0"
                title={`Edit column "${col.name}"`}
              >
                <Edit className="h-3 w-3 text-gray-600" />
              </button>
            </>
          )}
        </div>
      ),
      accessorFn: (row: Row) => {
        const cell = row.cellValuesByColumnId?.[col.id]
        if (!cell) return null
        return col.type === "NUMBER" ? (cell.numberValue ?? null) : (cell.textValue ?? null)
      },
      cell: (info) => {
        const val = info.getValue()
        const row = info.row.original

        return (
          <EditableCell
            val={val}
            rowId={row.id}
            colId={col.id}
            type={col.type}
            onSave={saveEdit}
          />
        )
      }
    })), [visibleColumns, saveEdit, handleEditColumn, editingColumnId, editingColumnName, handleSaveColumnName, handleCancelColumnEdit])

  // CHANGE THIS: Use localFlatData for table length calculations
  const totalFetched = localFlatData.length;

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement
        //once the user has scrolled within 500px of the bottom of the table, fetch more data if we can
        if (
          scrollHeight - scrollTop - clientHeight < 500 &&
          !isFetchingNextPage &&
          totalFetched < totalDBRowCount
        ) {
          fetchNextPage()
        }
      }
    },
    [fetchNextPage, isFetchingNextPage, totalFetched, totalDBRowCount]
  )

  useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current)
  }, [fetchMoreOnBottomReached])

  // CHANGE THIS: Use localFlatData instead of flatData
  const tableInstance = useReactTable({
    data: localFlatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = tableInstance.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 33, //estimate row height for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.current,
    //measure dynamic row height, except in firefox because it measures table border height incorrectly
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  })
  
  // FIXED: Add new column function with proper state management
  const addNewColumn = async () => {
    if (!newColumnName.trim() || !tableId) return;

    try {
      await addColumnMutation.mutateAsync({
        name: newColumnName.trim(),
        type: newColumnType,
        position: columnsState.length,
        tableId: tableId,
      });
      
      // The onSuccess callback will handle state updates and refetch
    } catch (error) {
      console.error("Failed to add column: ", error);
    }
  };

  const addNewRow = async () => {
    if (!tableId) return;
    
    try {
      const newRow = await addRowMutation.mutateAsync({
        tableId: tableId,
      });

      const newRowId = newRow.id;

      // Create new row data structure with empty cells for all columns
      const newRowData: Row = {
        id: newRowId,
        createdAt: new Date(),
        cellValuesByColumnId: columnsState.reduce((acc, col) => {
          acc[col.id] = {
            id: `temp-${newRowId}-${col.id}`, // Temporary ID for new cells
            createdAt: new Date(),
            updatedAt: new Date(),
            rowId: newRowId,
            columnId: col.id,
            textValue: col.type === "TEXT" ? "" : null,
            numberValue: col.type === "NUMBER" ? null : null,
          };
          return acc;
        }, {} as Record<string, CellValue>),
      };

      // Add the new row to local state immediately for fast UI update
      setLocalFlatData((prev) => [...prev, newRowData]);
      countRefetch()

      // Optionally invalidate queries to ensure data consistency
      // This will refetch the data in the background
      queryClient.invalidateQueries({ 
        queryKey: [["row", "getRows"], { input: { tableId, limit: 200, filters, sorts, search } }] 
      });
      
    } catch (error) {
      console.error("Failed to add row:", error);
    }
  };

  // Check all loading states
  if (isLoadingRows || columnQuery.isLoading || isInitializingSampleData) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2">
          {isInitializingSampleData 
            ? "Setting up your table with sample data..." 
            : "Loading table data..."
          }
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error loading data: {error.message}
      </div>
    );
  }

  return (
    <>
      <div
        ref={tableContainerRef} // This is the scrollable container
        className="flex-1 overflow-auto border-gray-300 h-[95%] relative" // 'relative' needed for sticky header if you add it
        onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
      >
        <table className="border-b border-r border-gray-300 border-collapse"> 
          <thead>
            {tableInstance.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="border-b border-r border-black/20 bg-gray-100 p-1 text-center min-w-[120px] h-8 font-normal"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                {/* Add Column Button */}
                <th
                  className="border-b border-r border-black/20 bg-gray-100 p-1 text-center min-w-[90px] h-8 font-normal cursor-pointer hover:bg-gray-200"
                  onClick={() => setIsAddColumnDialogOpen(true)}
                >
                  <PlusIcon className="mx-auto w-4 h-4 text-gray-600 hover:text-blue-600" />
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null; // Defensive check

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index} // for debugging
                  ref={rowVirtualizer.measureElement} // measure height for dynamic sizing
                  className="border-b border-gray-300"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`, // Use virtualRow.start directly
                    position: 'absolute',
                    width: '100%',
                    left: 0,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-r text-center border-gray-300 min-w-[120px] h-10 bg-white p-0"
                      style={{ width: cell.column.getSize() }} // Use column's size for width
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
            {/* Spacer row to enable proper scrolling for virtualized content */}
            <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }} />
          </tbody>
        </table>
      </div>

      {/* Add Column Dialog */}
      {isAddColumnDialogOpen && (
        <div className="fixed inset-0  backdrop-blur-sm z-40 flex items-center justify-center ">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Column</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Column Name
              </label>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter column name"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Column Type
              </label>
              <select
                value={newColumnType}
                onChange={(e) => setNewColumnType(e.target.value as "TEXT" | "NUMBER")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAddColumnDialogOpen(false);
                  setNewColumnName("");
                  setNewColumnType("TEXT");
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addNewColumn}
                disabled={!newColumnName.trim() || addColumnMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {addColumnMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
      <div>
      <button
        type="button"
        onClick={addNewRow}
        className="absolute bottom-12 right-10 z-10 flex items-center gap-2 rounded-xl border border-gray-300 bg-white p-2 shadow-lg transition-all duration-200 hover:bg-gray-50 hover:shadow-xl"
        title="Add new row"
      >
        <PlusIcon className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
        <span className="text-sm text-gray-700">Add New Row</span>
      </button>
    </div>

    {/* Footer */}
    <div className="border-t border-gray-300 bg-gray-50 px-4 py-2 flex justify-between items-center text-sm text-gray-600">
      <div className="flex items-center gap-2 cursor-pointer"
        onClick={addNewRow}>
        <PlusIcon className="w-4 h-4 text-gray-500" />
        <span className="text-gray-500">Add...</span>
      </div>
      <div>
        <span>{countData?.total} records</span>
      </div>
    </div>
    </>
  )
}