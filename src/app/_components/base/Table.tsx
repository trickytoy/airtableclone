"use client"

import { useEffect, useState } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
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
  cellValues: CellValue[]
}

export type TableData = {
  id: string | null | undefined
  name: string
  columns: Column[]
  rows: Row[]
}

type TableViewProps = {
  tableId?: string | null
}

export default function TableView({ tableId }: TableViewProps) {

  const [table, setTable] = useState<TableData>({
    id: tableId,
    name: "New Table",
    columns: [],
    rows: [],
  })

  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "NUMBER">("TEXT")
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editValue, setEditValue] = useState("")

  const { data: curtable } = api.table.getById.useQuery({ id: tableId ?? "" });

  const addColumnMutation = api.column.create.useMutation()
  const addRowMutation = api.row.create.useMutation()
  const upsertCellValue = api.cellValue.upsert.useMutation();

  useEffect(() => {
    if (!curtable) return;

    setTable((prev) => ({
      ...prev,
      id: curtable.id,
      name: curtable.name,
      columns: curtable.columns.map((col) => ({
        id: col.id,
        name: col.name,
        type: col.type,
      })),
      rows: curtable.rows.map((row) => ({
        id: row.id,
        cellValues: row.cellValues,
      })),
    }));

    console.log(curtable)
  }, [curtable]);

  // Map columns for react-table (removed Row ID column)
  const columns: ColumnDef<Row, string | number | null>[] = table.columns.map((col) => ({
    accessorFn: (row: Row) => {
      const cell = row.cellValues.find((cv) => cv.columnId === col.id)
      if (!cell) return null
      return col.type === "NUMBER" ? (cell.numberValue ?? null) : (cell.textValue ?? null)
    },
    id: col.id,
    header: col.name,
    cell: (info: { getValue: () => string | number | null; row: { original: Row } }) => {
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
      await upsertCellValue.mutateAsync({
        rowId,
        columnId,
        textValue,
        numberValue: numValue,
      });

      // Now safely update state after success
      setTable((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => {
          if (row.id !== rowId) return row;

          const updatedCellValues = row.cellValues.map((cell) =>
            cell.columnId === columnId
              ? {
                  ...cell,
                  textValue: isTextColumn ? editValue : null,
                  numberValue: isNumberColumn ? numValue : null,
                }
              : cell
          );

          return { ...row, cellValues: updatedCellValues };
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
      // Call tRPC mutation and get the actual column from backend
      const createdColumn = await addColumnMutation.mutateAsync({
        name: newColumnName.trim(),
        type: newColumnType,
        position: table.columns.length,
        tableId: table.id,
      });

      // Use the ID returned from backend
      const newColumn: Column = {
        id: createdColumn.id,
        name: createdColumn.name,
        type: createdColumn.type,
      };

      // Update the table state
      setTable((prev) => ({
        ...prev,
        columns: [...prev.columns, newColumn],
        rows: prev.rows.map((row) => ({
          ...row,
          cellValues: [
            ...row.cellValues,
            {
              columnId: newColumn.id,
              textValue: newColumnType === "TEXT" ? "" : null,
              numberValue: newColumnType === "NUMBER" ? null : null,
            },
          ],
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
      // Call tRPC mutation and get the actual row ID
      const newRow = await addRowMutation.mutateAsync({
        tableId: tableId,
      });

      const newRowId = newRow.id; // Get the row ID from tRPC response

      const newRowData: Row = {
        id: newRowId,
        cellValues: table.columns.map((col) => ({
          columnId: col.id,
          textValue: col.type === "TEXT" ? "" : null,
          numberValue: col.type === "NUMBER" ? null : null,
        })),
      };

      setTable((prev) => ({
        ...prev,
        rows: [...prev.rows, newRowData],
      }));
    } catch (error) {
      console.error("Failed to add row:", error);
    }
  };


  return (
    <div>
      <div className="relative">
        <div className="flex">
          {/* Main Table */}
          {table.columns.length > 0 ? (
            <table className="border border-gray-300 border-collapse">
              <thead>
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
              </tbody>
            </table>
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
              className="border border-black/20 bg-gray-100 p-1 text-center min-w-[34px] h-[34px] font-normal cursor-pointer hover:bg-gray-200 transition-colors"
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
              className="border border-black/20 bg-gray-100 p-1 text-center min-w-[34px] h-[34px] font-normal cursor-pointer hover:bg-gray-200 transition-colors"
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
