"use client"

import { useRef, useEffect, useState } from "react"
import { X, Plus } from "lucide-react"

interface ViewPopupProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (viewName: string) => void
}

export function ViewPopup({ isOpen, onClose, onAdd }: ViewPopupProps) {
  const [viewName, setViewName] = useState("")
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
      handleResize() // Initial call to adjust the size
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("resize", handleResize)
    }
  }, [isOpen, onClose])

  const handleAdd = () => {
    if (viewName.trim()) {
      onAdd(viewName.trim())
      setViewName("")
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:top-full md:left-0 md:mt-1">
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={onClose} />
      
      <div className="flex items-end justify-center min-h-full md:block md:min-h-0">
        <div
          ref={popupRef}
          className="w-full max-w-md mx-4 mb-4 md:mx-0 md:mb-0 md:w-96 bg-white border border-gray-200 rounded-t-xl md:rounded-lg shadow-2xl md:shadow-lg transform transition-transform duration-200 ease-out"
          style={{
            maxHeight: 'calc(100vh - 2rem)', // Ensure it fits within the viewport
            minWidth: '320px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl md:rounded-t-lg z-10">
            <div className="flex items-center space-x-2">
              <Plus className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              <span className="text-base md:text-sm font-semibold md:font-medium text-gray-700">
                New View
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 md:p-3 space-y-3">
            <input
              type="text"
              placeholder="Enter view name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end items-center p-4 md:p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl md:rounded-b-lg">
            <button
              onClick={handleAdd}
              disabled={!viewName.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add View
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}