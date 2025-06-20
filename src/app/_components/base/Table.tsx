// TableView.tsx
"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { Loader2, Edit, Check, X, PlusIcon, Trash2 } from "lucide-react"
import { api } from "~/trpc/react"
import { EditableCell } from "./Cell" // Assuming EditableCell is in ./Cell
import React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useQueryClient } from "@tanstack/react-query"
import { faker } from '@faker-js/faker'
import ColDropdown from "../column/ColDropdown"

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
  search?: string
}

type CheckedRow = { index: number; id: string };


export default function TableView({
  tableId,
  filters = [],
  sorts = [],
  hiddenColumns = [],
  search = ""
}: TableViewProps) {
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement>(null)
  // State for hovered row
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  // State for checked rows
  const [checkedRows, setCheckedRows] = useState<CheckedRow[]>([]);
  // State for columns, initialized from API call
  const [columnsState, setColumnsState] = useState<Column[]>([])
  const [isInitializingSampleData, setIsInitializingSampleData] = useState(false)

  // Local state for fast updates
  const [localFlatData, setLocalFlatData] = useState<Row[]>([]);

  // Track which column is being edited
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnName, setEditingColumnName] = useState<string>("")

  // State for new column dialog
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "NUMBER">("TEXT")

  // State for edit column modal
  const [isEditColumnModalOpen, setIsEditColumnModalOpen] = useState(false)
  const [editColumnData, setEditColumnData] = useState<Column | null>(null)
  const [editColumnName, setEditColumnName] = useState("")
  const [editColumnType, setEditColumnType] = useState<"TEXT" | "NUMBER">("TEXT")

  // State for delete column modal
  const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false)
  const [deleteColumnData, setDeleteColumnData] = useState<Column | null>(null)

  // TRPC Queries and Mutations
  const columnQuery = api.column.getByTable.useQuery({ tableId: tableId ?? "" });
  const upsertCellValue = api.cellValue.upsert.useMutation({});
  const upsertCellValueSilent = api.cellValue.upsert.useMutation({
    onSuccess: () => {
      console.log('Silent save completed');
    },
    onError: (error) => {
      console.error('Silent save failed:', error);
    },
    meta: {
      skipInvalidation: true
    }
  });
  const editColumn = api.column.edit.useMutation({
    onSuccess: () => {
      void columnQuery.refetch();
      setIsEditColumnModalOpen(false);
      setEditColumnData(null);
      setEditColumnName("");
      setEditColumnType("TEXT");
    },
  });
  
  const deleteColumn = api.column.delete?.useMutation?.({
    onSuccess: () => {
      void columnQuery.refetch();
      setIsDeleteColumnModalOpen(false);
      setDeleteColumnData(null);
    },
  });
  
  const addColumnMutation = api.column.create.useMutation({
    onSuccess: () => {
      void columnQuery.refetch();
      setNewColumnName("");
      setNewColumnType("TEXT");
      setIsAddColumnDialogOpen(false);
    },
  });
  
  const addRowMutation = api.row.create.useMutation()

  const deleteRow = api.row.delete.useMutation({
    onSuccess: () => {
      void refetch();
      void countRefetch();
    },
  });

  const deleteMultipleRows = api.row.deleteMultiple?.useMutation?.({
    onSuccess: () => {
      void refetch();
      void countRefetch();
      setCheckedRows([]); // Clear selection after successful delete
    },
  });

  // Batch mutations for initializing sample data
  const createMultipleColumnsMutation = api.column.createMultiple?.useMutation?.({
    onSuccess: () => {
      void columnQuery.refetch();
    },
  });
  
  const createMultipleRowsMutation = api.row.createMultiple?.useMutation?.({
    onSuccess: () => {
      void refetch();
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
      enabled: !!tableId && !!columnQuery.data,
    }
  );

  const { data: countData, refetch: countRefetch } = api.row.count.useQuery({ tableId: tableId ?? "" });
  const totalDBRowCount = countData?.total ?? 0;

  useEffect(() => {
    const handleFocusChange = () => {
      console.log("Focused element:", document.activeElement)
    }

    window.addEventListener("focusin", handleFocusChange)

    return () => {
      window.removeEventListener("focusin", handleFocusChange)
    }
  }, [])

  // Function to generate sample columns with faker data
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

  // Function to generate sample rows with faker data
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

  // Initialize sample data when no columns exist
  const initializeSampleData = useCallback(async () => {
    if (!tableId || isInitializingSampleData) return;
    
    setIsInitializingSampleData(true);
    
    try {
      const sampleColumnsData = generateSampleColumns();
      
      if (createMultipleColumnsMutation) {
        await createMultipleColumnsMutation.mutateAsync(sampleColumnsData);
      } else {
        for (const columnData of sampleColumnsData) {
          await addColumnMutation.mutateAsync(columnData);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: newColumns } = await columnQuery.refetch();
      
      if (newColumns && newColumns.length > 0) {
        const mappedColumns = newColumns.map(col => ({
          id: col.id,
          name: col.name,
          type: col.type as "TEXT" | "NUMBER"
        }));
        
        const sampleRowsData = generateSampleRows(mappedColumns, 5);
        
        if (createMultipleRowsMutation) {
          await createMultipleRowsMutation.mutateAsync(sampleRowsData);
        } else {
          for (const rowData of sampleRowsData) {
            const newRow = await addRowMutation.mutateAsync({
              tableId: tableId,
            });
            
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

  // Check if we need to initialize sample data
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

  // Server data for syncing
  const serverFlatData = useMemo(
    () => rowQuery?.pages.flatMap(page => page.formattedRows) ?? [],
    [rowQuery?.pages]
  );

  // Sync server data to local state when it changes
  useEffect(() => {
    setLocalFlatData(serverFlatData);
  }, [serverFlatData]);

  // Handle edit column modal
  const handleEditColumn = useCallback((column: Column) => {
    setEditColumnData(column);
    setEditColumnName(column.name);
    setEditColumnType(column.type);
    setIsEditColumnModalOpen(true);
  }, []);

  // Handle delete column modal
  const handleDeleteColumn = useCallback((column: Column) => {
    setDeleteColumnData(column);
    setIsDeleteColumnModalOpen(true);
  }, []);

  // Save column edit
  const handleSaveColumnEdit = useCallback(async () => {
    if (!editColumnData || !editColumnName.trim()) return;

    try {
      await editColumn.mutateAsync({
        id: editColumnData.id,
        name: editColumnName.trim(),
        type: editColumnType,
        position: columnsState.findIndex(col => col.id === editColumnData.id),
      });
    } catch (error) {
      console.error("Failed to update column:", error);
    }
  }, [editColumnData, editColumnName, editColumnType, columnsState, editColumn]);

  // Delete column
  const handleConfirmDeleteColumn = useCallback(async () => {
    if (!deleteColumnData || !deleteColumn) return;

    try {
      await deleteColumn.mutateAsync({ id: deleteColumnData.id });
    } catch (error) {
      console.error("Failed to delete column:", error);
    }
  }, [deleteColumnData, deleteColumn]);

    // Updated saveEdit with fast local updates
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

    // Store the current state for potential rollback
    const previousData = localFlatData;

    // Immediate UI update (optimistic)
    setLocalFlatData(prev => prev.map(row => {
      if (row.id === rowId) {
        const existingCell = row.cellValuesByColumnId[columnId];
        return {
          ...row,
          cellValuesByColumnId: {
            ...row.cellValuesByColumnId,
            [columnId]: {
              ...existingCell,
              id: existingCell?.id ?? `temp-${rowId}-${columnId}`,
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
      await utils.cellValue.updateCellValue.fetch({
        rowId,
        columnId,
        textValue: typeof editValue === 'string' ? editValue : undefined,
        numberValue: typeof editValue === 'number' ? editValue : undefined,
      });
    } catch (error) {
      console.error('Failed to update cell:', error);
    }

  }, [columnsState, upsertCellValue, localFlatData]);

  const saveEditOnly = useCallback(async (rowId: string, columnId: string, editValue: string) => {
    console.log('Silent save called for:', { rowId, columnId, editValue });
    
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

    try {
      // Use the silent mutation that won't trigger re-renders
      await upsertCellValueSilent.mutateAsync({
        rowId,
        columnId,
        textValue: textValue ?? undefined,
        numberValue: numValue ?? undefined,
      });
      
      console.log('Silent save successful for:', { rowId, columnId, editValue });
      
    } catch (error) {
      console.error("Failed to save cell edit silently", error);
      // Don't throw the error to avoid disrupting the tabbing flow
    }
  }, [columnsState, upsertCellValueSilent]);

    // Filter out hidden columns and map columns for react-table
    const visibleColumns = useMemo(() => {
      return columnsState.filter(col => !hiddenColumns.includes(col.id));
    }, [columnsState, hiddenColumns]);

const columns: ColumnDef<Row, string | number | null>[] = useMemo(
  () => visibleColumns.map((col) => ({
    id: col.id,
    header: () => (
      <div className="flex items-center justify-between w-full group">
        <span className="truncate flex-1">{col.name}</span>
        <ColDropdown
          Column={col}
          onEdit={handleEditColumn}
          onDelete={handleDeleteColumn}
        />
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
          onSave={saveEdit}        // Regular save (with re-render)
          onSaveOnly={saveEditOnly} // Save-only (no re-render)
        />
      )
    }
  })), [visibleColumns, saveEdit, saveEditOnly, handleEditColumn, handleDeleteColumn]) // Added saveEditOnly dependency
  
  const totalFetched = localFlatData.length;

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement
        if (
          scrollHeight - scrollTop - clientHeight < 1000 &&
          !isFetchingNextPage &&
          totalFetched < totalDBRowCount
        ) {
          fetchNextPage()
        }
      }
    },
    [fetchNextPage, isFetchingNextPage, totalFetched, totalDBRowCount]
  )

  const tableInstance = useReactTable({
    data: localFlatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = tableInstance.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 33,
    getScrollElement: () => tableContainerRef.current,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined,
    overscan: 10,
  })
  
  // Add new column function
  const addNewColumn = async () => {
    if (!newColumnName.trim() || !tableId) return;

    try {
      await addColumnMutation.mutateAsync({
        name: newColumnName.trim(),
        type: newColumnType,
        position: columnsState.length,
        tableId: tableId,
      });
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

      const newRowData: Row = {
        id: newRowId,
        createdAt: new Date(),
        cellValuesByColumnId: columnsState.reduce((acc, col) => {
          acc[col.id] = {
            id: `temp-${newRowId}-${col.id}`,
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

      setLocalFlatData((prev) => [...prev, newRowData]);
      countRefetch()

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



  const handleDeleteSelectedRows = async () => {
    if (checkedRows.length === 0) return;
    
    const rowIds = checkedRows.map(row => row.id);

    setCheckedRows([]);
    
    // Optimistic update - remove rows from local state immediately
    setLocalFlatData(prev => prev.filter(row => !rowIds.includes(row.id)));
    
    try {
      if (deleteMultipleRows && rowIds.length > 1) {
        // Use batch delete if available and deleting multiple rows
        await deleteMultipleRows.mutateAsync({ rowIds });
      } else {
        // Delete rows individually
        await Promise.all(
          rowIds.map(rowId => deleteRow.mutateAsync({ id: rowId }))
        );
      }
      
      // Clear checked rows after successful deletion
      setCheckedRows([]);
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ 
        queryKey: [["row", "getRows"], { input: { tableId, limit: 200, filters, sorts, search } }] 
      });
      
    } catch (error) {
      // Revert optimistic update on error
      setLocalFlatData(serverFlatData);
      console.error("Failed to delete selected rows:", error);
      // You might want to show a toast notification here
    }
  };

  const toggleCheckbox = (index: number, rowId: string) => {
    setCheckedRows((prev) => {
      const exists = prev.some((r) => r.id === rowId);
      if (exists) {
        return prev.filter((r) => r.id !== rowId);
      } else {
        return [...prev, { index, id: rowId }];
      }
    });
  };

  return (
<>
  <div
    ref={tableContainerRef}
    className="flex-1 overflow-y-auto   overflow-x-scroll border-gray-300 h-[95%] relative"
    onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
  >
    <table className="border-b border-r border-gray-300 border-collapse">
      <thead>
        {tableInstance.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            <th
              className="border-b border-black/20 bg-gray-100 p-1 text-center w-10 h-8 font-normal"
            >
              {checkedRows.length > 0 && (
                <button
                  className="w-full h-full flex items-center justify-center hover:bg-gray-200 rounded"
                  onClick={handleDeleteSelectedRows}
                >
                  <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-600 transition-colors" />
                </button>
              )}
            </th>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                colSpan={header.colSpan}
                className="border-b border-r border-black/20 bg-gray-100 p-1 text-center w-32 h-8 font-normal text-nowrap  text-ellipsis"
                style={{ width: header.getSize() }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
            <th
              className="border-b border-r border-black/20 bg-gray-100 p-1 text-center w-24 h-8 font-normal cursor-pointer hover:bg-gray-200"
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
          //console.log(row)
          if (!row) return null;

          return (
            <tr
              key={row.id}
              tabIndex={-1}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className={`border-b border-gray-300 `}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                position: 'absolute',
                width: '100%',
                left: 0,
              }}
            >
            <td
              className={`text-center opacity-50 border-gray-300 w-10 h-10 p-0 text-nowrap text-[10px]  whitespace-nowrap overflow-hidden text-ellipsis ${
                checkedRows.some((r) => r.index === virtualRow.index) ? "bg-blue-50" : "bg-white"
              }`}
              tabIndex={-1}
              onMouseEnter={() => setHoveredRow(virtualRow.index)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {(hoveredRow === virtualRow.index || checkedRows.some((r) => r.index === virtualRow.index)) ? (
                <input
                  type="checkbox"
                  checked={checkedRows.some((r) => r.index === virtualRow.index)}
                  onChange={() => toggleCheckbox(virtualRow.index, row.original.id)}
                  className="cursor-pointer"
                />
              ) : (
                // Conditional rendering for the index
                virtualRow.index + 1 >= 10000 ?
                  `${((virtualRow.index + 1) / 1000)}k` :
                  virtualRow.index + 1
              )}
            </td>
              {row.getVisibleCells().map((cell) => (
                <td
                  tabIndex={-1}
                  key={cell.id}
                  className={`border-r text-center border-gray-300 w-32 h-10 ${
                    checkedRows.some((r) => r.index === virtualRow.index) ? "bg-blue-50" : "bg-white"
                  } p-0 text-nowrap overflow-hidden text-ellipsis`}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              <td className={` border-black/20 p-1 text-center w-24 h-8 font-normal`}>

              </td>

            </tr>
          )
        })}
        <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }} />
      </tbody>
    </table>
  </div>

  {/* Add Column Dialog */}
  {isAddColumnDialogOpen && (
    <div className="fixed inset-0 backdrop-blur-sm z-40 flex items-center justify-center">
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

  {/* Edit Column Modal */}
  {isEditColumnModalOpen && editColumnData && (
    <div className="fixed inset-0 backdrop-blur-sm z-40 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-4">Edit Column</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Column Name
          </label>
          <input
            type="text"
            value={editColumnName}
            onChange={(e) => setEditColumnName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter column name"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIsEditColumnModalOpen(false);
              setEditColumnData(null);
              setEditColumnName("");
              setEditColumnType("TEXT");
            }}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveColumnEdit}
            disabled={!editColumnName.trim() || editColumn.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {editColumn.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Delete Column Modal */}
  {isDeleteColumnModalOpen && deleteColumnData && (
    <div className="fixed inset-0 backdrop-blur-sm z-40 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-4">Delete Column</h3>

        <p className="text-gray-600 mb-6">
          Are you sure you want to delete the column "{deleteColumnData.name}"?
          This action cannot be undone and will permanently delete all data in this column.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIsDeleteColumnModalOpen(false);
              setDeleteColumnData(null);
            }}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDeleteColumn}
            disabled={deleteColumn?.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deleteColumn?.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete Column
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
    <div className="flex items-center gap-2 cursor-pointer" onClick={addNewRow}>
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