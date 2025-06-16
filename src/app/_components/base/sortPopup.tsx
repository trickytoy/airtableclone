"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ArrowUpDown, X, Plus, ArrowUp, ArrowDown } from "lucide-react"

type Column = {
  id: string
  name: string
  type: "TEXT" | "NUMBER"
}

type SortCriteria = {
  id: string
  columnId: string
  direction: "asc" | "desc"
}

type SortPopupProps = {
  isOpen: boolean
  onClose: () => void
  onApply: (sorts: SortCriteria[]) => void
  columns: Column[]
}

export function SortPopup({ isOpen, onClose, onApply, columns }: SortPopupProps) {
  const [sorts, setSorts] = useState<SortCriteria[]>([])
  const popupRef = useRef<HTMLDivElement>(null)
  const applyTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce timeout

  // Debounced function to call onApply
  const applySortsDebounced = useCallback((currentSorts: SortCriteria[]) => {
    if (applyTimeoutRef.current) {
      clearTimeout(applyTimeoutRef.current);
    }
    applyTimeoutRef.current = setTimeout(() => {
      onApply(currentSorts);
    }, 300); // 300ms debounce delay
  }, [onApply]); // onApply is a dependency

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      // Clear any pending apply when component unmounts or closes
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }
    }
  }, [isOpen, onClose])

  const addSort = () => {
    const firstCol = columns[0]
    if (!firstCol) return

    // Find the first available column that isn't already sorted
    const availableColumn = columns.find(col => !sorts.some(sort => sort.columnId === col.id));

    if (!availableColumn) return;

    setSorts((prev) => {
      const newSort: SortCriteria = {
        id: Date.now().toString(),
        columnId: availableColumn.id,
        direction: "asc",
      };
      const updatedSorts = [...prev, newSort];
      applySortsDebounced(updatedSorts); // Apply debounced after state update
      return updatedSorts;
    });
  }

  const removeSort = (id: string) => {
    setSorts(prevSorts => {
      const updatedSorts = prevSorts.filter((sort) => sort.id !== id);
      applySortsDebounced(updatedSorts); // Apply debounced after state update
      return updatedSorts;
    });
  }

  const updateSort = (id: string, key: keyof SortCriteria, value: string) => {
    setSorts(prevSorts => {
      const updatedSorts = prevSorts.map((sort) =>
        sort.id === id ? { ...sort, [key]: value } : sort
      );
      // If the column changes, we might want to reset the direction to a default based on the new column type
      if (key === "columnId") {
        const newColumn = getColumnById(value);
        if (newColumn) {
          // You could set a default direction here if desired, e.g., 'asc'
          // For now, we'll keep the existing direction or 'asc' if it's new
        }
      }
      applySortsDebounced(updatedSorts); // Apply debounced after state update
      return updatedSorts;
    });
  }

  const moveSort = (id: string, direction: "up" | "down") => {
    setSorts(prevSorts => {
      const currentIndex = prevSorts.findIndex(sort => sort.id === id);
      if (currentIndex === -1) return prevSorts;

      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prevSorts.length) return prevSorts;

      const newSorts = [...prevSorts];
      const [movedSort] = newSorts.splice(currentIndex, 1);
      newSorts.splice(newIndex, 0, movedSort!);
      applySortsDebounced(newSorts); // Apply debounced after state update
      return newSorts;
    });
  }

  // clearAll is now also debounced
  const clearAll = () => {
    setSorts([]);
    applySortsDebounced([]); // Apply an empty sort set
  }

  const getColumnById = (id: string) => columns.find((col) => col.id === id)

  const getAvailableColumns = (currentSortId?: string) => {
    return columns.filter(col =>
      !sorts.some(sort => sort.columnId === col.id && sort.id !== currentSortId)
    )
  }

  if (!isOpen) return null

  return (
    <div className="absolute top-full left-0 mt-1 z-50">
      <div
        ref={popupRef}
        className="w-auto bg-white border border-gray-200 rounded-lg shadow-lg transform transition-transform duration-200 ease-out"
        style={{
          minWidth: '380px'
        }}
      >
        {/* Header */}
        <div className="p-3">
          <p className="text-sm pb-1 border-b-2 border-gray-300 text-gray-500 font-medium mb-3">Sort by</p>

          {/* Sort Content */}
          <div className="space-y-2">
            {sorts.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <ArrowUpDown className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">No sorting applied</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add sort criteria to organize your data
                </p>
              </div>
            )}
            {sorts.map((sort, index) => {
              const col = getColumnById(sort.columnId);
              const availableColumns = getAvailableColumns(sort.id);

              // Determine display text for directions based on column type
              const ascText = col?.type === "NUMBER" ? "1 -> 9" : "A -> Z";
              const descText = col?.type === "NUMBER" ? "9 -> 1" : "Z -> A";

              return (
                <div
                  key={sort.id}
                  className="flex items-center space-x-2" // Adjusted spacing
                >
                  {/* Priority Indicator */}
                  {sorts.length > 1 && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {index + 1}
                    </span>
                  )}

                  {/* Column Selector */}
                  <select
                    value={sort.columnId}
                    onChange={(e) => updateSort(sort.id, "columnId", e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 bg-white"
                  >
                    {/* Ensure the currently selected column is always an option, even if it's no longer 'available' */}
                    {col && !availableColumns.find(c => c.id === col.id) && (
                      <option value={col.id}>{col.name}</option>
                    )}
                    {availableColumns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>

                  {/* Direction */}
                  <select
                    value={sort.direction}
                    onChange={(e) => updateSort(sort.id, "direction", e.target.value as "asc" | "desc")}
                    className="px-2 py-1 text-sm border border-b border-gray-300 bg-white"
                  >
                    <option value="asc">{ascText}</option>
                    <option value="desc">{descText}</option>
                  </select>

                  {/* Move up/down buttons */}
                  {sorts.length > 1 && (
                    <>
                      <button
                        onClick={() => moveSort(sort.id, "up")}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ArrowUp className="w-4 h-4" /> {/* Adjusted icon size */}
                      </button>
                      <button
                        onClick={() => moveSort(sort.id, "down")}
                        disabled={index === sorts.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ArrowDown className="w-4 h-4" /> {/* Adjusted icon size */}
                      </button>
                    </>
                  )}

                  {/* Delete Icon */}
                  <button
                    onClick={() => removeSort(sort.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add Sort Button */}
          <div className="flex justify-between items-center mt-3">
            <button
              onClick={addSort}
              disabled={columns.length === 0 || sorts.length >= columns.length}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent"
            >
              <Plus className="w-4 h-4" />
              <span>Add another sort</span>
            </button>
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              disabled={sorts.length === 0}
            >
              Clear All ({sorts.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}