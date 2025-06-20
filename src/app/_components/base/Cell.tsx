// EditableCell.tsx - Enhanced with save-only function for better tabbing
import React, { useState, useCallback, useEffect, useRef } from "react"

interface EditableCellProps {
  val: string | number | null
  rowId: string
  colId: string
  type: "TEXT" | "NUMBER"
  onSave: (rowId: string, colId: string, value: string) => Promise<void>
  onSaveOnly?: (rowId: string, colId: string, value: string) => Promise<void> // New save-only prop
}

export const EditableCell = React.memo(function EditableCell({
  val,
  rowId,
  colId,
  type,
  onSave,
  onSaveOnly,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  
  // Track optimistic state
  const [optimisticValue, setOptimisticValue] = useState<string | number | null>(val)
  const [isOptimistic, setIsOptimistic] = useState(false)
  const originalValueRef = useRef<string | number | null>(val)

  // Update refs when prop changes (from server state updates)
  useEffect(() => {
    if (!isOptimistic) {
      originalValueRef.current = val
      setOptimisticValue(val)
    }
  }, [val, isOptimistic])

  // Reset optimistic state when server value changes and matches our optimistic value
  useEffect(() => {
    if (isOptimistic && val === optimisticValue) {
      setIsOptimistic(false)
    }
  }, [val, optimisticValue, isOptimistic])

  const startEdit = useCallback(() => {
    setIsEditing(true)
    const currentVal = isOptimistic ? optimisticValue : val
    setEditValue(currentVal !== null && currentVal !== undefined ? currentVal.toString() : "")
  }, [val, optimisticValue, isOptimistic])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue("")
    
    // If we have an optimistic value that failed, revert it
    if (isOptimistic) {
      setOptimisticValue(originalValueRef.current)
      setIsOptimistic(false)
    }
  }, [isOptimistic])

  const revertOptimisticUpdate = useCallback(() => {
    setOptimisticValue(originalValueRef.current)
    setIsOptimistic(false)
  }, [])

  const handleFocus = useCallback(() => {
    if (!isEditing) {
      startEdit()
    }
  }, [isEditing, startEdit])

  // Regular save function (causes re-render)
  const saveEdit = useCallback(async () => {
    const currentDisplayValue = isOptimistic ? optimisticValue : val
    const currentDisplayString = currentDisplayValue !== null && currentDisplayValue !== undefined ? currentDisplayValue.toString() : ""
    
    // Only save if the value has actually changed
    if (editValue === currentDisplayString) {
      setIsEditing(false)
      return
    }

    // Set optimistic value immediately
    const newOptimisticValue = type === "NUMBER" 
      ? (editValue === "" || isNaN(Number(editValue)) ? null : Number.parseFloat(editValue))
      : editValue || null

    setOptimisticValue(newOptimisticValue)
    setIsOptimistic(true)
    setIsEditing(false)
    setEditValue("")

    try {
      await onSave(rowId, colId, editValue)
      // Success - the useEffect will reset isOptimistic when server state updates
    } catch (error) {
      console.error("Failed to save cell edit", error)
      // Revert optimistic update on failure
      revertOptimisticUpdate()
      
      // Optionally re-enter edit mode with the failed value
      setIsEditing(true)
      setEditValue(editValue)
    }
  }, [rowId, colId, editValue, onSave, val, optimisticValue, isOptimistic, type, revertOptimisticUpdate])

  // Save-only function (no re-render) - for tabbing scenarios
  const saveEditSilent = useCallback(async () => {
    const currentDisplayValue = isOptimistic ? optimisticValue : val
    const currentDisplayString = currentDisplayValue !== null && currentDisplayValue !== undefined ? currentDisplayValue.toString() : ""
    
    // Only save if the value has actually changed
    if (editValue === currentDisplayString) {
      setIsEditing(false)
      return
    }

    // Set optimistic value immediately
    const newOptimisticValue = type === "NUMBER" 
      ? (editValue === "" || isNaN(Number(editValue)) ? null : Number.parseFloat(editValue))
      : editValue || null

    setOptimisticValue(newOptimisticValue)
    setIsOptimistic(true)
    setIsEditing(false)
    setEditValue("")

    try {
      // Use save-only function if available, fallback to regular save
      const saveFunction = onSaveOnly || onSave
      await saveFunction(rowId, colId, editValue)
      // Success - optimistic state will be reset when data eventually syncs
    } catch (error) {
      console.error("Failed to save cell edit", error)
      // Revert optimistic update on failure
      revertOptimisticUpdate()
      
      // Optionally re-enter edit mode with the failed value
      setIsEditing(true)
      setEditValue(editValue)
    }
  }, [rowId, colId, editValue, onSave, onSaveOnly, val, optimisticValue, isOptimistic, type, revertOptimisticUpdate])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }, [])

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (!isEditing) return
    
    if (e.key === "Enter") {
      e.preventDefault()
      await saveEdit() // Use regular save for Enter (user expects immediate feedback)
    }
    
    if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
    }
    
    // Handle Tab key - use silent save to avoid re-render disrupting tab navigation
    if (e.key === "Tab") {
      // Don't prevent default - let tab navigation happen naturally
      await saveEdit()
    }
  }, [isEditing, saveEdit, saveEditSilent, cancelEdit])

  const handleClick = useCallback(() => {
    if (!isEditing) startEdit()
  }, [isEditing, startEdit])

  // Use silent save for blur to avoid disrupting focus when tabbing
  const handleBlur = useCallback(async (e: React.FocusEvent) => {
    if (!isEditing) return
    
    // Check if the focus is moving to another editable cell
    const relatedTarget = e.relatedTarget as HTMLElement
    const isMovingToAnotherCell = relatedTarget?.closest('[data-editable-cell]')
    
    if (isMovingToAnotherCell && onSaveOnly) {
      // Use silent save when tabbing between cells
      await saveEditSilent()
    } else {
      // Use regular save for other blur events
      await saveEdit()
    }
  }, [isEditing, saveEdit, saveEditSilent, onSaveOnly])

  // Display value logic
  const displayValue = isEditing 
    ? editValue 
    : (isOptimistic ? optimisticValue : val) ?? ""

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%' }}
      data-editable-cell // Add marker for blur detection
    >
      <input
        key={`${rowId}-${colId}`} // Stable key to prevent recreation on re-render
        tabIndex={0}
        type={type === "NUMBER" ? "number" : "text"}
        value={displayValue}
        readOnly={!isEditing}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onBlur={handleBlur}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: isEditing ? "white" : "transparent",
          boxSizing: "border-box",
          cursor: isEditing ? "text" : "pointer",
          textAlign: "center",
          opacity: isOptimistic ? 0.7 : 1, // Visual indicator for optimistic state
          fontStyle: isOptimistic ? "italic" : "normal"
        }}
        onFocus={handleFocus}
      />
      
      {/* Optional: Visual indicator for optimistic updates */}
      {isOptimistic && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '4px',
            height: '4px',
            backgroundColor: '#fbbf24', // Amber color for "pending"
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  )
})