"use client"

import { useState, useRef, useEffect } from "react"
import { Filter, X, Plus } from "lucide-react"

type Column = {
  id: string
  name: string
  type: "TEXT" | "NUMBER"
}

type FilterCondition = {
  id: string
  columnId: string
  operator: string
  value: string
}

type FilterPopupProps = {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterCondition[]) => void
  columns: Column[]
}

const textOperators = ["contains", "does not contain", "is", "is not", "is empty", "is not empty"]
const numberOperators = ["=", "!=", ">", "<", "is empty", "is not empty"]

export function FilterPopup({ isOpen, onClose, onApply, columns }: FilterPopupProps) {
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const popupRef = useRef<HTMLDivElement>(null)

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
    }
  }, [isOpen, onClose])

  const addFilter = () => {
  const firstCol = columns[0]
  if (!firstCol) return

  const operator =
    firstCol.type === "TEXT"
      ? textOperators[0] ?? "contains"
      : numberOperators[0] ?? "="

  setFilters((prev) => [
    ...prev,
    {
      id: Date.now().toString(),
      columnId: firstCol.id,
      operator, // always defined
      value: "",
    },
  ])
}

  const removeFilter = (id: string) => {
    setFilters(filters.filter((filter) => filter.id !== id))
  }

  const updateFilter = (id: string, key: keyof FilterCondition, value: string) => {
    setFilters(filters.map((filter) => (filter.id === id ? { ...filter, [key]: value } : filter)))
  }

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const clearAll = () => {
    setFilters([])
  }

  const getColumnById = (id: string) => columns.find((col) => col.id === id)

  if (!isOpen) return null

  return (
    <div className="absolute top-full left-0 mt-1 z-50 max-h-[80vh] overflow-auto">
      <div
        ref={popupRef}
        className="bg-white border border-gray-200 rounded-lg shadow-lg w-80 max-w-full p-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filter</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {filters.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Filter className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No filters applied</p>
              <p className="text-xs text-gray-400">Add a filter to get started</p>
            </div>
          ) : (
            filters.map((filter) => {
              const col = getColumnById(filter.columnId)
              const operators = col?.type === "NUMBER" ? numberOperators : textOperators

              return (
                <div key={filter.id} className="space-y-2">
                  {/* Field Selector */}
                  <select
                    value={filter.columnId}
                    onChange={(e) => {
                      const newCol = getColumnById(e.target.value)
                      updateFilter(filter.id, "columnId", e.target.value)
                        updateFilter(
                        filter.id,
                        "operator",
                        newCol?.type === "NUMBER"
                            ? numberOperators[0] ?? "="
                            : textOperators[0] ?? "contains"
                        )
                      updateFilter(filter.id, "value", "")
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>

                  {/* Operator & Value */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(filter.id, "operator", e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {operators.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    {!["is empty", "is not empty"].includes(filter.operator) && (
                      <input
                        type={col?.type === "NUMBER" ? "number" : "text"}
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}

                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add Filter */}
        <button
          onClick={addFilter}
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 mb-4"
        >
          <Plus className="w-4 h-4" />
          <span>Add filter</span>
        </button>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <button
            onClick={clearAll}
            className="text-sm text-gray-500 hover:text-gray-700"
            disabled={filters.length === 0}
          >
            Clear all
          </button>
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
