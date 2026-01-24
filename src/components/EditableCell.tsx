import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditableCellProps {
  value: any;
  isEditMode: boolean;
  onSave: (newValue: string) => void;
  type?: "text" | "number" | "textarea";
  className?: string;
  align?: "left" | "center" | "right";
}

export const EditableCell = ({
  value,
  isEditMode,
  onSave,
  type = "text",
  className = "",
  align = "left",
}: EditableCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (isEditMode) setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (currentValue != value) {
        onSave(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      handleBlur();
    }
  };

  if (isEditing && isEditMode) {
    if (type === "textarea") {
      return (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          className="min-h-[60px] text-xs p-1"
        />
      );
    }
    return (
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === "number" ? "number" : "text"}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-8 text-xs p-1"
        step="any"
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`cursor-pointer min-h-[20px] ${className} ${
        isEditMode ? "hover:bg-yellow-50 hover:border hover:border-yellow-300 rounded" : ""
      } text-${align}`}
    >
      {currentValue}
    </div>
  );
};