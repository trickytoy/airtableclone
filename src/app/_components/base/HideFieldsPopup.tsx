"use client"

import { useState, useRef, useEffect } from "react"
import { EyeOff, Eye, X } from "lucide-react"

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

  const toggleColumn = (columnId: string) => {
    setHiddenColumns(prev => 
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    )
  }

  const handleApply = () => {
    onApply(hiddenColumns)
    onClose()
  }

  const showAll = () => {
    setHiddenColumns([])
  }

  const hideAll = () => {
    setHiddenColumns(columns.map(col => col.id))
  }

  const visibleCount = columns.length - hiddenColumns.length
  const hiddenCount = hiddenColumns.length

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
              <EyeOff className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              <span className="text-base md:text-sm font-semibold md:font-medium text-gray-700">
                Hide Fields
              </span>
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                {visibleCount} visible
              </span>
            </div>
            <button 
              onClick={onClose} 
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Fields Content */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="p-4 md:p-3 space-y-3 md:space-y-2 overflow-y-auto"
              style={{ maxHeight: 'calc(60vh - 120px)' }}
            >
              {columns.length === 0 ? (
                <div className="text-center py-8 md:py-6 text-gray-500">
                  <EyeOff className="w-12 h-12 md:w-8 md:h-8 mx-auto mb-3 md:mb-2 text-gray-300" />
                  <p className="text-base md:text-sm font-medium">No fields available</p>
                  <p className="text-sm md:text-xs text-gray-400 mt-1">
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
                        className={`flex items-center justify-between p-3 md:p-2 rounded-lg border transition-colors cursor-pointer hover:bg-gray-50 ${
                          isHidden 
                            ? 'bg-gray-50 border-gray-200' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleColumn(column.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <button
                            className={`p-1 rounded transition-colors ${
                              isHidden
                                ? 'text-gray-400 hover:text-gray-600'
                                : 'text-blue-600 hover:text-blue-700'
                            }`}
                          >
                            {isHidden ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
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
                        
                        <div className={`px-2 py-1 text-xs rounded-full ${
                          isHidden 
                            ? 'bg-gray-200 text-gray-600' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {isHidden ? 'Hidden' : 'Visible'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {columns.length > 0 && (
              <div className="px-4 md:px-3 pb-3 flex items-center space-x-2">
                <button
                  onClick={showAll}
                  disabled={hiddenCount === 0}
                  className="flex-1 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-blue-300 hover:border-blue-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Show All
                </button>
                <button
                  onClick={hideAll}
                  disabled={visibleCount === 0}
                  className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 border border-dashed border-gray-300 hover:border-gray-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hide All
                </button>
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between p-4 md:p-3 border-t border-gray-100 bg-gray-50 sticky bottom-0 rounded-b-xl md:rounded-b-lg">
            <div className="text-sm text-gray-500">
              {hiddenCount > 0 && (
                <span>{hiddenCount} field{hiddenCount !== 1 ? 's' : ''} hidden</span>
              )}
              {hiddenCount === 0 && (
                <span>All fields visible</span>
              )}
            </div>
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
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}