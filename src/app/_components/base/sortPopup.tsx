"use client"

import { useState, useRef, useEffect } from "react"
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

  const addSort = () => {
    const firstCol = columns[0]
    if (!firstCol) return

    // Check if column is already being sorted
    const isAlreadySorted = sorts.some(sort => sort.columnId === firstCol.id)
    const availableColumn = isAlreadySorted 
      ? columns.find(col => !sorts.some(sort => sort.columnId === col.id))
      : firstCol

    if (!availableColumn) return

    setSorts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        columnId: availableColumn.id,
        direction: "asc",
      },
    ])
  }

  const removeSort = (id: string) => {
    setSorts(sorts.filter((sort) => sort.id !== id))
  }

  const updateSort = (id: string, key: keyof SortCriteria, value: any) => {
    setSorts(sorts.map((sort) => (sort.id === id ? { ...sort, [key]: value } : sort)))
  }

  const moveSort = (id: string, direction: "up" | "down") => {
    const currentIndex = sorts.findIndex(sort => sort.id === id)
    if (currentIndex === -1) return

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= sorts.length) return

    const newSorts = [...sorts]
    const [movedSort] = newSorts.splice(currentIndex, 1)
    newSorts.splice(newIndex, 0, movedSort!)
    setSorts(newSorts)
  }

  const handleApply = () => {
    onApply(sorts)
    onClose()
  }

  const clearAll = () => {
    setSorts([])
  }

  const getColumnById = (id: string) => columns.find((col) => col.id === id)

  const getAvailableColumns = (currentSortId?: string) => {
    return columns.filter(col => 
      !sorts.some(sort => sort.columnId === col.id && sort.id !== currentSortId)
    )
  }

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
              <ArrowUpDown className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              <span className="text-base md:text-sm font-semibold md:font-medium text-gray-700">
                Sort Data
              </span>
              {sorts.length > 0 && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {sorts.length}
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

          {/* Sort Content */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="p-4 md:p-3 space-y-4 md:space-y-3 overflow-y-auto"
              style={{ maxHeight: 'calc(60vh - 120px)' }}
            >
              {sorts.length === 0 ? (
                <div className="text-center py-8 md:py-6 text-gray-500">
                  <ArrowUpDown className="w-12 h-12 md:w-8 md:h-8 mx-auto mb-3 md:mb-2 text-gray-300" />
                  <p className="text-base md:text-sm font-medium">No sorting applied</p>
                  <p className="text-sm md:text-xs text-gray-400 mt-1">
                    Add sort criteria to organize your data
                  </p>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-3">
                  {sorts.map((sort, index) => {
                    const col = getColumnById(sort.columnId)
                    const availableColumns = getAvailableColumns(sort.id)

                    return (
                      <div 
                        key={sort.id} 
                        className="p-3 md:p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-3 md:space-y-2"
                      >
                        {/* Sort header with priority indicator and controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Sort {index + 1}
                            </span>
                            {sorts.length > 1 && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                Priority {index + 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            {/* Move up/down buttons */}
                            {sorts.length > 1 && (
                              <>
                                <button
                                  onClick={() => moveSort(sort.id, "up")}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title="Move up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveSort(sort.id, "down")}
                                  disabled={index === sorts.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title="Move down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => removeSort(sort.id)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Column and Direction Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2">
                          {/* Column Selector */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-600">Column</label>
                            <select
                              value={sort.columnId}
                              onChange={(e) => updateSort(sort.id, "columnId", e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              {/* Current selection */}
                              {col && !availableColumns.find(c => c.id === col.id) && (
                                <option value={col.id}>{col.name}</option>
                              )}
                              {/* Available columns */}
                              {availableColumns.map((column) => (
                                <option key={column.id} value={column.id}>
                                  {column.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Direction */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-600">Direction</label>
                            <select
                              value={sort.direction}
                              onChange={(e) => updateSort(sort.id, "direction", e.target.value as "asc" | "desc")}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              <option value="asc">Ascending (A-Z, 1-9)</option>
                              <option value="desc">Descending (Z-A, 9-1)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Add Sort Button */}
            <div className="px-4 md:px-3 pb-3">
              <button
                onClick={addSort}
                disabled={columns.length === 0 || sorts.length >= columns.length}
                className="flex items-center justify-center space-x-2 w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-blue-300 hover:border-blue-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {sorts.length >= columns.length 
                    ? "All columns sorted" 
                    : "Add Another Sort"
                  }
                </span>
              </button>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between p-4 md:p-3 border-t border-gray-100 bg-gray-50 sticky bottom-0 rounded-b-xl md:rounded-b-lg">
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              disabled={sorts.length === 0}
            >
              Clear All ({sorts.length})
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
                Apply Sort
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}