
"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface AutocompleteOption {
  value: string
  label: string
  searchText?: string
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Autocomplete({
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  className,
  disabled = false,
}: AutocompleteProps) {
  const [inputValue, setInputValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Filter options based on input
  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return options
    const searchTerm = inputValue.toLowerCase()
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm) ||
      option.searchText?.toLowerCase().includes(searchTerm)
    )
  }, [options, inputValue])

  // Set input value when value prop changes
  useEffect(() => {
    const selectedOption = options.find(option => option.value === value)
    if (selectedOption) {
      setInputValue(selectedOption.label)
    } else if (!value) {
      setInputValue("")
    }
  }, [value, options])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
    
    // If input is cleared, clear selection
    if (!newValue.trim()) {
      onValueChange?.("")
    }
  }

  // Handle option selection
  const handleOptionSelect = (option: AutocompleteOption) => {
    setInputValue(option.label)
    setIsOpen(false)
    setHighlightedIndex(-1)
    onValueChange?.(option.value)
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
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("w-full", className)}
        autoComplete="off"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {filteredOptions.map((option, index) => (
            <li
              key={option.value}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm hover:bg-gray-100",
                highlightedIndex === index && "bg-gray-100",
                value === option.value && "bg-blue-50 text-blue-600"
              )}
              onClick={() => handleOptionSelect(option)}
            >
              <div className="flex items-center justify-between">
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      
      {isOpen && filteredOptions.length === 0 && inputValue.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
          <div className="text-sm text-gray-500">No items found</div>
        </div>
      )}
    </div>
  )
}
