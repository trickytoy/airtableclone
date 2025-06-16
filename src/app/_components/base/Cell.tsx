// Cell.tsx (No changes needed, but included for completeness)
import React, { useState, useCallback } from "react"

interface EditableCellProps {
  val: string | number | null
  rowId: string
  colId: string
  type: "TEXT" | "NUMBER"
  onSave: (rowId: string, colId: string, value: string) => Promise<void>
}

export const EditableCell = React.memo(function EditableCell({
  val,
  rowId,
  colId,
  type,
  onSave,
}: EditableCellProps) {
  // Move editing state into the individual cell
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")

  const startEdit = useCallback(() => {
    setIsEditing(true)
    setEditValue(val !== null && val !== undefined ? val.toString() : "")
  }, [val])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue("")
  }, [])

  const saveEdit = useCallback(async () => {
    // Only save if the value has actually changed
    console.log("here")
    console.log(editValue)
    if (editValue === (val !== null && val !== undefined ? val.toString() : "")) {

      setIsEditing(false);
      return;
    }

    try {
      await onSave(rowId, colId, editValue)
      setIsEditing(false)
      setEditValue("")

    } catch (error) {
      console.error("Failed to save cell edit", error)
    }
  }, [rowId, colId, editValue, onSave, val])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }, [])

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (!isEditing) return
    if (e.key === "Enter") {
      e.preventDefault()
      await saveEdit()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
    }
  }, [isEditing, saveEdit, cancelEdit])

  const handleClick = useCallback(() => {
    if (!isEditing) startEdit()
  }, [isEditing, startEdit])

  return (
    <input
      type={type === "NUMBER" ? "number" : "text"}
      value={isEditing ? editValue : val ?? ""}
      readOnly={!isEditing}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onBlur={isEditing ? saveEdit : undefined}
      style={{
        width: "100%",
        border: "none",
        background: isEditing ? "white" : "transparent",
        padding: "4px",
        boxSizing: "border-box",
        cursor: isEditing ? "text" : "pointer",
        textAlign: "center"
         // Added outline for better UX
      }}
    />
  )
})