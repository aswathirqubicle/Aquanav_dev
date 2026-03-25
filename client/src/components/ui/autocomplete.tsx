
"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AutocompleteOption {
  value: string
  label: string
  searchText?: string
  description?: string
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function Autocomplete({
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  emptyMessage = "No items found",
  className,
  disabled = false,
}: AutocompleteProps) {
  const [inputValue, setInputValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Filter options based on input
  const filteredOptions = React.useMemo(() => {
    // If not actively editing (typing), show all options
    if (!isEditing) return options
    if (!inputValue.trim()) return options

    const searchTerm = inputValue.toLowerCase()
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm) ||
      option.searchText?.toLowerCase().includes(searchTerm)
    )
  }, [options, inputValue, isEditing])

  // Set input value when value prop changes (only when not editing)
  useEffect(() => {
    if (isEditing) return
    const selectedOption = options.find(option => option.value === value)
    if (selectedOption) {
      setInputValue(selectedOption.label)
    } else if (!value) {
      setInputValue("")
    }
  }, [value, options, isEditing])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
    setIsEditing(true)
  }

  // Handle option selection
  const handleOptionSelect = (option: AutocompleteOption) => {
    setInputValue(option.label)
    setIsOpen(false)
    setHighlightedIndex(-1)
    setIsEditing(false)
    onValueChange?.(option.value)
  }

  // Reset input to current selection
  const resetInputToSelection = () => {
    const selectedOption = options.find(option => option.value === value)
    if (selectedOption) {
      setInputValue(selectedOption.label)
    } else {
      setInputValue("")
    }
    setIsEditing(false)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true)
        setHighlightedIndex(0)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleOptionSelect(filteredOptions[highlightedIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        setHighlightedIndex(-1)
        resetInputToSelection()
        inputRef.current?.blur()
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node) &&
        listRef.current && !listRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
        resetInputToSelection()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value, options])

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex])

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onClick={() => setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn("w-full", className)}
                autoComplete="off"
              />
            </div>
          </TooltipTrigger>
          {!isOpen && !isEditing && inputValue && (
            <TooltipContent>
              <p>{inputValue}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-auto"
          style={{ position: 'absolute', top: '100%', left: 0 }}
        >
          {filteredOptions.map((option, index) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <li
                  className={cn(
                    "px-3 py-2 cursor-pointer text-sm hover:bg-gray-100 dark:hover:bg-slate-700",
                    highlightedIndex === index && "bg-gray-100 dark:bg-slate-700",
                    value === option.value && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  )}
                  onClick={() => handleOptionSelect(option)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate line-clamp-1">
                          {option.description}
                        </span>
                      )}
                    </div>
                    {value === option.value && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                </li>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{option.label}</p>
                  {option.description && <p className="text-xs">{option.description}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </ul>
      )}
      </TooltipProvider>

      {isOpen && filteredOptions.length === 0 && inputValue.trim() && (
        <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg p-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</div>
        </div>
      )}
    </div>
  )
}
