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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleResize = () => {
      // Force re-render on window resize for better responsiveness
      if (popupRef.current) {
        popupRef.current.style.maxWidth = `${Math.min(400, window.innerWidth - 32)}px`
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      window.addEventListener("resize", handleResize)
      handleResize() // Initial call
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("resize", handleResize)
    }
  }, [isOpen, onClose])

  const addFilter = () => {
    const firstCol = columns[0]
    if (!firstCol) return

    const operator: FilterCondition["operator"] =
      firstCol.type === "TEXT"
        ? "contains"
        : "="

    setFilters((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        columnId: firstCol.id,
        operator,
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
    <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:top-full md:left-0 md:mt-1">
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 md:hidden" onClick={onClose} />
      
      {/* Popup container */}
      <div className="flex items-end justify-center min-h-full md:block md:min-h-0">
        <div
          ref={popupRef}
          className="w-full max-w-md mx-4 mb-4 md:mx-0 md:mb-0 md:w-96 md:max-w-none bg-white border border-gray-200 rounded-t-xl md:rounded-lg shadow-2xl md:shadow-lg transform transition-transform duration-200 ease-out"
          style={{
            maxHeight: 'calc(100vh - 2rem)',
            minWidth: '320px'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl md:rounded-t-lg z-10">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              <span className="text-base md:text-sm font-semibold md:font-medium text-gray-700">
                Filter Data
              </span>
              {filters.length > 0 && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {filters.length}
                </span>
              )}
            </div>
            <button 
              onClick={onClose} 
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Filters Content */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="p-4 md:p-3 space-y-4 md:space-y-3 overflow-y-auto"
              style={{ maxHeight: 'calc(60vh - 120px)' }}
            >
              {filters.length === 0 ? (
                <div className="text-center py-8 md:py-6 text-gray-500">
                  <Filter className="w-12 h-12 md:w-8 md:h-8 mx-auto mb-3 md:mb-2 text-gray-300" />
                  <p className="text-base md:text-sm font-medium">No filters applied</p>
                  <p className="text-sm md:text-xs text-gray-400 mt-1">
                    Add filters to narrow down your data
                  </p>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-3">
                  {filters.map((filter, index) => {
                    const col = getColumnById(filter.columnId)
                    const operators = col?.type === "NUMBER" ? numberOperators : textOperators
                    const needsValue = !["is empty", "is not empty"].includes(filter.operator)

                    return (
                      <div 
                        key={filter.id} 
                        className="p-3 md:p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-3 md:space-y-2"
                      >
                        {/* Filter number indicator */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Filter {index + 1}
                          </span>
                          <button
                            onClick={() => removeFilter(filter.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Column Selector */}
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-600">Column</label>
                          <select
                            value={filter.columnId}
                            onChange={(e) => {
                              const newColumnId = e.target.value
                              const newCol = getColumnById(newColumnId)
                              const newOperator: FilterCondition["operator"] = newCol?.type === "NUMBER"
                                ? "="
                                : "contains"
                              
                              setFilters(prevFilters => 
                                prevFilters.map(f => 
                                  f.id === filter.id 
                                    ? { ...f, columnId: newColumnId, operator: newOperator, value: "" }
                                    : f
                                )
                              )
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          >
                            {columns.map((col) => (
                              <option key={col.id} value={col.id}>
                                {col.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Operator & Value Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2">
                          {/* Operator */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-600">Condition</label>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateFilter(filter.id, "operator", e.target.value as FilterCondition["operator"])}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              {operators.map((op) => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Value */}
                          {needsValue && (
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-600">Value</label>
                              <input
                                type={col?.type === "NUMBER" ? "number" : "text"}
                                value={filter.value}
                                onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
                                placeholder={col?.type === "NUMBER" ? "Enter number" : "Enter text"}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Add Filter Button */}
            <div className="px-4 py-3 md:px-3 pb-3">
              <button
                onClick={addFilter}
                disabled={columns.length === 0}
                className="flex items-center justify-center space-x-2 w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-blue-300 hover:border-blue-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Filter</span>
              </button>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between p-4 md:p-3 border-t border-gray-100 bg-gray-50 sticky bottom-0 rounded-b-xl md:rounded-b-lg">
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              disabled={filters.length === 0}
            >
              Clear All ({filters.length})
            </button>
            <div className="flex items-center space-x-2">
              <button 
                onClick={onClose} 
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}