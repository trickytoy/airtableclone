"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { Plus, Loader2 } from "lucide-react"
import { api } from "~/trpc/react"

type Column = {
  id: string
  name: string
  type: "TEXT" | "NUMBER"
}

type CellValue = {
  columnId: string
  textValue?: string | null
  numberValue?: number | null
}

type Row = {
  id: string
  createdAt: Date
  cellValuesByColumnId: {
    [columnId: string]: {
      id: string
      createdAt: Date
      updatedAt: Date
      rowId: string
      columnId: string
      textValue: string | null
      numberValue: number | null
    }
  }
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
}




export default function TableView({ tableId, filters = [], sorts = [] }: TableViewProps) {
  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "NUMBER">("TEXT")
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editValue, setEditValue] = useState("")

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

  const transformedFilters = filters.map(filter => ({
    columnId: filter.columnId,
    operator: filter.operator,
    value: filter.value
  }))

  console.log(transformedFilters)

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
      sorts: sorts
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!tableId,
    }
  );

  const addColumnMutation = api.column.create.useMutation()
  const addRowMutation = api.row.create.useMutation()
  const upsertCellValue = api.cellValue.upsert.useMutation();

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Trigger fetch when user scrolls to 80% of the container
    if (scrollPercentage > 0.8 && hasNextPage && !isFetchingNextPage) {
      console.log('Triggering fetchNextPage from scroll')
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Set up scroll listener with dependencies that ensure it works immediately
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Add scroll listener
    container.addEventListener('scroll', handleScroll, { passive: true })
    
    // Also check immediately if we need to load more (in case content is short)
    const checkInitialLoad = () => {
      const { scrollHeight, clientHeight } = container
      if (scrollHeight <= clientHeight && hasNextPage && !isFetchingNextPage) {
        console.log('Content shorter than container, loading more')
        fetchNextPage()
      }
    }
    
    // Check after a brief delay to ensure DOM is settled
    const timeoutId = setTimeout(checkInitialLoad, 100)
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [handleScroll, hasNextPage, isFetchingNextPage, fetchNextPage, table.rows.length])

  console.log(columnQuery)
  console.log(rowQuery)

  useEffect(() => {
    // Only sync local state if fresh server data has arrived
    if (!tableinfo || !columnQuery.data || !rowQuery?.pages) return;

    const columns = columnQuery.data.map((col) => ({
      id: col.id,
      name: col.name,
      type: col.type,
    }));

    const rows = rowQuery.pages.flatMap((page) => page.rows).map((row) => ({
      id: row.id,
      createdAt: new Date(row.createdAt),
      cellValuesByColumnId: row.cellValuesByColumnId,
    }));

    setTable({
      id: tableId,
      name: tableinfo.name,
      columns,
      rows,
    });
  }, [tableinfo?.id, columnQuery.data, rowQuery?.pages.length]);

  // Map columns for react-table (removed Row ID column)
  const columns: ColumnDef<Row, string | number | null>[] = table.columns.map((col) => ({
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
      const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id

      if (isEditing) {
        return (
          <input
            type={col.type === "NUMBER" ? "number" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(row.id, col.id)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await saveEdit(row.id, col.id)
              } else if (e.key === "Escape") {
                cancelEdit()
              }
            }}
            className="w-full h-full border-none outline-none bg-blue-50 px-1"
            autoFocus
          />
        )
      }

      return (
        <div
          onClick={() => startEdit(row.id, col.id, val)}
          className="w-full h-full cursor-pointer hover:bg-gray-50 px-1 py-1"
        >
          {val !== null && val !== undefined ? val.toString() : ""}
        </div>
      )
    },
  }))

  const tableInstance = useReactTable({
    data: table.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const startEdit = (rowId: string, columnId: string, currentValue: string | number | null) => {
    setEditingCell({ rowId, columnId })
    setEditValue(currentValue !== null && currentValue !== undefined ? currentValue.toString() : "")
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue("")
  }

  const saveEdit = async (rowId: string, columnId: string) => {
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
            [columnId]: updatedCellValue, // <-- use the returned updated cellValue here
          };

          return { ...row, cellValuesByColumnId: updatedCellValues };
        }),
      }));

      setEditingCell(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to save cell edit", error);
    }
  };

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
        }, {} as Record<string, {
          id: string;
          createdAt: Date;
          updatedAt: Date;
          rowId: string;
          columnId: string;
          textValue: string | null;
          numberValue: number | null;
        }>),
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
          {table.columns.length > 0 ? (
            <div 
              ref={scrollContainerRef}
              className="max-h-[700px] overflow-auto border border-gray-300"
            >
              <table className="border border-gray-300 border-collapse">
                <thead className="">
                  {tableInstance.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="border border-black/20 bg-gray-100 p-1 text-left min-w-[120px] h-8 font-normal"
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
                        <td key={cell.id} className="border-r border-gray-300 min-w-[120px] h-10 bg-white p-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  
                  {/* Loading indicator for infinite scroll */}
                  {isFetchingNextPage && (
                    <tr>
                      <td colSpan={table.columns.length} className="text-center py-4">
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
                      <td colSpan={table.columns.length} className="text-center py-4">
                        <span className="text-sm text-gray-500">No more rows to load</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-gray-300 bg-gray-50 p-8 text-center text-gray-500 min-w-[300px]">
              <p className="text-lg mb-2">No columns yet</p>
              <p className="text-sm">Click the + button to add your first column</p>
            </div>
          )}

          {/* Add Column Button - Right side of table, aligned with header */}
          <div className="flex flex-col">
            <button
              onClick={() => setIsAddColumnDialogOpen(true)}
              className="border border-black/20 bg-gray-100 p-1 text-center min-w-[35px] h-[35px] font-normal cursor-pointer hover:bg-gray-200 transition-colors"
            >
              <Plus className="opacity-50 w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>

        {/* Add Row Button - Bottom left of table */}
        {table.columns.length > 0 && (
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