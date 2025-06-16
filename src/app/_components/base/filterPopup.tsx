"use client"

import { useState, useRef, useEffect, useCallback } from "react" // Added useCallback
import { Filter, X, Plus } from "lucide-react"

type Column = {
  id: string
  name: string
  type: "TEXT" | "NUMBER"
}

type FilterCondition = {
  id: string
  columnId: string
  operator: "is" | "is not" | "contains" | "does not contain" | "is empty" | "is not empty" | "=" | "!=" | ">" | "<"
  value: string
}

type FilterPopupProps = {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterCondition[]) => void
  columns: Column[]
}

const textOperators: FilterCondition["operator"][] = ["contains", "does not contain", "is", "is not", "is empty", "is not empty"]
const numberOperators: FilterCondition["operator"][] = ["=", "!=", ">", "<", "is empty", "is not empty"]

export function FilterPopup({ isOpen, onClose, onApply, columns }: FilterPopupProps) {
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const popupRef = useRef<HTMLDivElement>(null)
  const applyTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounce timeout

  // Debounced function to call onApply
  const applyFiltersDebounced = useCallback((currentFilters: FilterCondition[]) => {
    if (applyTimeoutRef.current) {
      clearTimeout(applyTimeoutRef.current);
    }
    applyTimeoutRef.current = setTimeout(() => {
      onApply(currentFilters);
    }, 300); // 300ms debounce delay
  }, [onApply]); // onApply is a dependency

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      // Clear any pending apply when component unmounts or closes
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }
    }
  }, [isOpen, onClose]);


  const addFilter = () => {
    const firstCol = columns[0]
    if (!firstCol) return

    const operator: FilterCondition["operator"] =
      firstCol.type === "TEXT"
        ? "contains"
        : "="

    setFilters((prev) => {
      const newFilter: FilterCondition = { // Explicitly type newFilter
        id: Date.now().toString(),
        columnId: firstCol.id,
        operator,
        value: "",
      };
      const updatedFilters = [...prev, newFilter];
      applyFiltersDebounced(updatedFilters); // Apply debounced after state update
      return updatedFilters;
    });
  }

  const removeFilter = (id: string) => {
    setFilters(prevFilters => {
      const updatedFilters = prevFilters.filter((filter) => filter.id !== id);
      applyFiltersDebounced(updatedFilters); // Apply debounced after state update
      return updatedFilters;
    });
  }

  const updateFilter = (id: string, key: keyof FilterCondition, value: string) => {
    setFilters(prevFilters => {
      const updatedFilters = prevFilters.map((filter) => {
        if (filter.id === id) {
          const newFilter = { ...filter, [key]: value };
          // If changing column or operator, reset value to avoid invalid state
          if (key === "columnId" || key === "operator") {
            newFilter.value = "";
          }
          return newFilter;
        }
        return filter;
      });
      applyFiltersDebounced(updatedFilters); // Apply debounced after state update
      return updatedFilters;
    });
  }


  // The handleApply function is now essentially replaced by applyFiltersDebounced
  // This function is no longer called directly by UI, but kept for clarity on original purpose
  // const handleApply = () => {
  //   onApply(filters);
  //   onClose();
  // };

  // clearAll is not used in the simplified UI based on the image, but kept for completeness

  const getColumnById = (id: string) => columns.find((col) => col.id === id)

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
          <p className="text-sm text-gray-500 font-medium mb-3">In this view, show records</p>

          {/* Filters Content */}
          <div className="space-y-2">
            {filters.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <Filter className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">No active filters</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add conditions to narrow down your data
                </p>
              </div>
            )}
            {filters.map((filter, index) => {
              const col = getColumnById(filter.columnId)
              const operators = col?.type === "NUMBER" ? numberOperators : textOperators
              const needsValue = !["is empty", "is not empty"].includes(filter.operator)

              return (
                <div
                  key={filter.id}
                  className="flex items-center"
                >
                  {/* Where/And text */}
                  {index === 0 ? (
                    <span className="text-sm text-gray-700">Where</span>
                  ) : (
                    <span className="text-sm text-gray-700">And</span>
                  )}

                  {/* Column Selector */}
                  <select
                    value={filter.columnId}
                    onChange={(e) => {
                      const newColumnId = e.target.value;
                      updateFilter(filter.id, "columnId", newColumnId);
                    }}
                    className="px-2 py-1 text-sm border ml-2 border-gray-300 bg-white"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, "operator", e.target.value as FilterCondition["operator"])}
                    className="px-2 py-1 text-sm border-t border-b border-gray-300  bg-white"
                  >
                    {operators.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>

                  {/* Value Input */}
                  {needsValue && (
                    <input
                      type={col?.type === "NUMBER" ? "number" : "text"}
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
                      placeholder="Enter a value"
                      className="flex-grow px-2 py-1 text-sm border border-gray-300 focus:border-transparent"
                    />
                  )}

                  {/* Delete Icon (Trash Can) */}
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Three Dots Icon (More Options) */}
                  <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                    <span className="font-bold">...</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add Filter Buttons */}
          <div className="flex space-x-2 mt-3">
            <button
              onClick={addFilter}
              disabled={columns.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent"
            >
              <Plus className="w-4 h-4" />
              <span>Add condition</span>
            </button>
            <button
              onClick={addFilter} // Currently behaves the same as "Add condition"
              disabled={columns.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent"
            >
              <Plus className="w-4 h-4" />
              <span>Add condition group</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}