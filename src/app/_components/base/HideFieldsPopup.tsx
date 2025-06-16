"use client"

import { useState, useRef, useEffect } from "react"
import { ToggleLeft, ToggleRight, X } from "lucide-react"

type Column = {
  id: string
  name: string
  type: "TEXT" | "NUMBER"
}

type HideFieldsPopupProps = {
  isOpen: boolean
  onClose: () => void
  onApply: (hiddenColumnIds: string[]) => void
  columns: Column[]
  initialHiddenColumns?: string[]
}

export function HideFieldsPopup({ 
  isOpen, 
  onClose, 
  onApply, 
  columns, 
  initialHiddenColumns = [] 
}: HideFieldsPopupProps) {
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(initialHiddenColumns)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleResize = () => {
      if (popupRef.current) {
        popupRef.current.style.maxWidth = `${Math.min(400, window.innerWidth - 32)}px`
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      window.addEventListener("resize", handleResize)
      handleResize()
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("resize", handleResize)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      onApply(hiddenColumns) // Apply changes after the render
    }
  }, [hiddenColumns, isOpen, onApply]) // Trigger when `hiddenColumns` or `isOpen` changes

  const toggleColumn = (columnId: string) => {
    setHiddenColumns(prev => 
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    )
  }

  const showAll = () => {
    setHiddenColumns([])
  }

  const hideAll = () => {
    const allHidden = columns.map(col => col.id)
    setHiddenColumns(allHidden)
  }

  const visibleCount = columns.length - hiddenColumns.length
  const hiddenCount = hiddenColumns.length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 sm:absolute sm:inset-auto top-full left-0 mt-1">
      <div className="flex items-end justify-center">
        <div
          ref={popupRef}
          className="bg-white border border-gray-200 w-[300px] rounded-t-xl rounded-lg shadow-md transform transition-transform duration-200 ease-out"
        >
          {/* Header */}
          <div className="flex items-center justify-between pt-3 pb-1 ml-3 mr-3 border-b-2 border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
            <div className="flex items-center space-x-1">
              <span className="text-base sm:text-sm font-semibold sm:font-medium text-gray-700">
                Hide Fields
              </span>
            </div>
            <button 
              onClick={onClose} 
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Fields List */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="p-2 space-y-2 overflow-y-auto"
            >
              {columns.length === 0 ? (
                <div className="text-center py-2 text-gray-500">
                  <p className="text-sm font-medium">No fields available</p>
                  <p className="text-sm sm:text-xs text-gray-400 mt-1">
                    Fields will appear here when available
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {columns.map((column) => {
                    const isHidden = hiddenColumns.includes(column.id)
                    
                    return (
                      <div 
                        key={column.id}
                        className={`flex items-center justify-between p-1 rounded-lg transition-colors hover:bg-gray-50 cursor-pointer ${
                          isHidden 
                            ? 'bg-gray-50 border-gray-200' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleColumn(column.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <div>
                            {isHidden ? (
                              <ToggleLeft className="w-4 h-4 text-red-500" />
                            ) : (
                              <ToggleRight className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${
                              isHidden ? 'text-gray-500' : 'text-gray-900'
                            }`}>
                              {column.name}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">
                              {column.type.toLowerCase()}
                            </p>
                          </div>
                        </div>
                        
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {columns.length > 0 && (
              <div className="px-8 pb-3 flex items-center space-x-1">
                <button
                  onClick={showAll}
                  disabled={hiddenCount === 0}
                  className="flex-1 py-2 text-sm text-black hover:text-gray-700 bg-gray-100 hover:bg-gray-50  rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Show All
                </button>
                <button
                  onClick={hideAll}
                  disabled={visibleCount === 0}
                  className="flex-1 py-2 text-sm text-black hover:text-gray-700 bg-gray-100 hover:bg-gray-50 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hide All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
