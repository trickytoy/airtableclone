"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { Plus, Loader2 } from "lucide-react"
import { api } from "~/trpc/react"
import { EditableCell } from "./Cell"

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

type TableData = {
  id: string | null | undefined
  name: string
  columns: Column[]
  rows: Row[]
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
  search: string
}

export default function TableView({ tableId, filters = [], sorts = [], hiddenColumns = [], search = "" }: TableViewProps) {
  // Managing states
  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "NUMBER">("TEXT")
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false)

  const [table, setTable] = useState<TableData>({
    id: tableId,
    name: "New Table",
    columns: [],
    rows: [],
  })

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { data: tableinfo } = api.table.getById.useQuery({ id: tableId ?? "" });
  const columnQuery = api.column.getByTable.useQuery({ tableId: tableId ?? "" });

  const transformedFilters = useMemo(() => {
    return filters.map(filter => ({
      columnId: filter.columnId,
      operator: filter.operator,
      value: filter.value
    }));
  }, [filters]);

  const {
    data: rowQuery,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = api.row.getByTable.useInfiniteQuery(
    {
      tableId: tableId ?? "",
      limit: 50,
      filters: transformedFilters,
      sorts: sorts,
      search: search,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!tableId,
    }
  );

  const addColumnMutation = api.column.create.useMutation()
  const addRowMutation = api.row.create.useMutation()
  const upsertCellValue = api.cellValue.upsert.useMutation({});

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Trigger fetch when user scrolls to 80% of the container
    if (scrollPercentage > 0.7 && hasNextPage && !isFetchingNextPage) {
      console.log('Triggering fetchNextPage from scroll')
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Set up scroll listener with dependencies that ensure it works immediately
  useEffect(() => {
    console.log("useEffect 1")
    const container = scrollContainerRef.current
    if (!container) return

    // Add scroll listener
    container.addEventListener('scroll', handleScroll, { passive: true })
    
    // Also check immediately if we need to load more (in case content is short)
    const checkInitialLoad = () => {
      const { scrollHeight, clientHeight } = container
      if (scrollHeight <= clientHeight && hasNextPage && !isFetchingNextPage) {
        console.log('Content shorter than container, loading more')
        void fetchNextPage()
      }
    }
    
    // Check after a brief delay to ensure DOM is settled
    const timeoutId = setTimeout(checkInitialLoad, 100)
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [handleScroll, hasNextPage, isFetchingNextPage, fetchNextPage, table.rows.length])

  useEffect(() => {
    console.log("useEffect 2")
    if (!tableinfo || !columnQuery.data || !rowQuery?.pages) return;

    const newColumns = columnQuery.data.map((col) => ({
      id: col.id,
      name: col.name,
      type: col.type,
    }));

    const newRows = rowQuery.pages
      .flatMap((page) => page.rows)
      .map((row) => ({
        id: row.id,
        createdAt: new Date(row.createdAt),
        cellValuesByColumnId: row.cellValuesByColumnId,
      }));

    // Prevent overwriting if data is already set
    setTable((prev) => {
      const dataIsEqual =
        JSON.stringify(prev.columns) === JSON.stringify(newColumns) &&
        JSON.stringify(prev.rows) === JSON.stringify(newRows);

      if (dataIsEqual) return prev;

      return {
        id: tableId,
        name: tableinfo.name,
        columns: newColumns,
        rows: newRows,
      };
    });
  }, [tableinfo, columnQuery.data, rowQuery?.pages, tableId]);

  const saveEdit = useCallback(async (rowId: string, columnId: string, editValue: string) => {
    const column = table.columns.find((col) => col.id === columnId);
    if (!column) return;

    const isNumberColumn = column.type === "NUMBER";
    const isTextColumn = column.type === "TEXT";

    const numValue = isNumberColumn
      ? editValue === "" || isNaN(Number(editValue))
        ? undefined
        : Number.parseFloat(editValue)
      : undefined;

    const textValue = isTextColumn ? editValue : undefined;

    try {
      // Await the mutation result, which includes the full upserted cellValue
      const updatedCellValue = await upsertCellValue.mutateAsync({
        rowId,
        columnId,
        textValue,
        numberValue: numValue,
      });

      // Update local state with the full fresh cellValue, including the id
      setTable((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => {
          if (row.id !== rowId) return row;

          const updatedCellValues = {
            ...row.cellValuesByColumnId,
            [columnId]: updatedCellValue,
          };

          return { ...row, cellValuesByColumnId: updatedCellValues };
        }),
      }));
    } catch (error) {
      console.error("Failed to save cell edit", error);
      throw error; // Re-throw so the cell can handle the error
    }
  }, [table.columns, upsertCellValue]);

   // Filter out hidden columns and map columns for react-table
  const visibleColumns = useMemo(() => {
    return table.columns.filter(col => !hiddenColumns.includes(col.id));
  }, [table.columns, hiddenColumns]);
  
  const columns: ColumnDef<Row, string | number | null>[] = useMemo(
  () => visibleColumns.map((col) => ({
    id: col.id,
    header: col.name,
    accessorFn: (rows: Row) => {
      const cell = rows.cellValuesByColumnId?.[col.id]
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
  })), [visibleColumns, saveEdit])

  const tableInstance = useReactTable({
    data: table.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const addNewColumn = async () => {
    if (!newColumnName.trim() || !table?.id) return;

    try {
      const createdColumn = await addColumnMutation.mutateAsync({
        name: newColumnName.trim(),
        type: newColumnType,
        position: table.columns.length,
        tableId: table.id,
      });

      const newColumn: Column = {
        id: createdColumn.id,
        name: createdColumn.name,
        type: createdColumn.type,
      };

      setTable((prev) => ({
        ...prev,
        columns: [...prev.columns, newColumn],
        rows: prev.rows.map((row) => ({
          ...row,
          cellValuesByColumnId: {
            ...row.cellValuesByColumnId,
            [newColumn.id]: {
              id: "",
              rowId: row.id,
              columnId: newColumn.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              textValue: newColumnType === "TEXT" ? "" : null,
              numberValue: newColumnType === "NUMBER" ? null : null,
            },
          },
        })),
      }));

      setNewColumnName("");
      setNewColumnType("TEXT");
      setIsAddColumnDialogOpen(false);
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
        cellValuesByColumnId: table.columns.reduce((acc, col) => {
          acc[col.id] = {
            id: "",
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

      setTable((prev) => ({
        ...prev,
        rows: [...prev.rows, newRowData],
      }));
    } catch (error) {
      console.error("Failed to add row:", error);
    }
  };

  // Loading state for initial load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        <span>Error loading table: {error.message}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <div className="flex">
          {/* Main Table */}
          {visibleColumns.length > 0 ? (
            <div 
              ref={scrollContainerRef}
              className="h-[60vh] w-full overflow-auto border-b border-r border-gray-300 flex"
            >
              <table className="border-b border-r border-gray-300 border-collapse">
                <thead className="">
                  {tableInstance.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="border-b border-r border-black/20 bg-gray-100 p-1 text-left min-w-[120px] h-8 font-normal"
                          style={{ width: '120px' }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {tableInstance.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-300">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border-r border-gray-300 min-w-[120px] h-10 bg-white p-0" style={{ width: '120px' }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  
                  {/* Loading indicator for infinite scroll */}
                  {isFetchingNextPage && (
                    <tr>
                      <td colSpan={visibleColumns.length} className="text-center py-4">
                        <div className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          <span className="text-sm text-gray-600">Loading more rows...</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {/* End of data indicator */}
                  {!hasNextPage && table.rows.length > 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length} className="text-center py-4">
                        <span className="text-sm text-gray-500">No more rows to load</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
                <div className="flex flex-col">
                  <button
                    onClick={() => setIsAddColumnDialogOpen(true)}
                    className="border-b border-r border-black/20 bg-gray-100 p-1 text-left min-w-[30px] h-8 font-normal"
                  >
                    <Plus className="opacity-50 w-4 h-4 mx-auto" />
                  </button>
                </div>
            </div>
          ) : (
            <div className="border border-gray-300 bg-gray-50 p-8 text-center text-gray-500 min-w-[300px]">
              <p className="text-lg mb-2">
                {table.columns.length === 0 ? "No columns yet" : "All columns are hidden"}
              </p>
              <p className="text-sm">
                {table.columns.length === 0 
                  ? "Click the + button to add your first column" 
                  : "Use the 'Hide fields' button to show columns"
                }
              </p>
            </div>
          )}

          {/* Add Column Button - Right side of table, aligned with header */}
          
        </div>

        {/* Add Row Button - Bottom left of table */}
        {visibleColumns.length > 0 && (
          <div className="flex">
            <button
              onClick={addNewRow}
              className="border border-black/20 bg-gray-100 p-1 text-center min-w-[35px] h-[35px] font-normal cursor-pointer hover:bg-gray-200 transition-colors"
            >
              <Plus className="opacity-50 w-4 h-4 mx-auto" />
            </button>
          </div>
        )}
      </div>

      {/* Modal for adding new column */}
      {isAddColumnDialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
          onClick={() => setIsAddColumnDialogOpen(false)}
        >
          <div className="bg-white p-6 rounded-lg min-w-[300px] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">Add New Column</h3>

            <div className="mb-4">
              <label htmlFor="columnName" className="block mb-1 font-medium">
                Column Name
              </label>
              <input
                id="columnName"
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Enter column name"
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="columnType" className="block mb-1 font-medium">
                Column Type
              </label>
              <select
                id="columnType"
                value={newColumnType}
                onChange={(e) => setNewColumnType(e.target.value as "TEXT" | "NUMBER")}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddColumnDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 bg-white rounded cursor-pointer text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addNewColumn}
                disabled={!newColumnName.trim()}
                className={`px-4 py-2 border rounded text-sm transition-colors ${
                  newColumnName.trim()
                    ? "border-blue-500 bg-blue-500 text-white cursor-pointer hover:bg-blue-600"
                    : "border-gray-300 bg-gray-300 text-white cursor-not-allowed"
                }`}
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}