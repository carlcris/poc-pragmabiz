import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (
    { className, type, onChange, inputMode, pattern, value, onFocus, onBlur, ...props },
    ref
  ) => {
    const isNumeric =
      type === "number" || inputMode === "decimal" || inputMode === "numeric"
    const numericPattern = /^-?\d*(\.\d*)?$/
    const resolvedInputMode = isNumeric ? inputMode ?? "decimal" : inputMode
    const resolvedPattern = isNumeric ? pattern ?? "^-?\\d*(\\.\\d*)?$" : pattern
    const toDisplayValue = React.useCallback(
      (nextValue: typeof value) =>
        nextValue === undefined || nextValue === null ? "" : String(nextValue),
      []
    )
    const isIncompleteNumeric = React.useCallback(
      (nextValue: string) =>
        nextValue === "" ||
        nextValue === "-" ||
        nextValue === "." ||
        nextValue === "-." ||
        nextValue.endsWith("."),
      []
    )
    const numericEqualsDisplay = React.useCallback(
      (nextValue: typeof value, currentDisplay: string) => {
        if (isIncompleteNumeric(currentDisplay)) {
          return false
        }
        if (nextValue === undefined || nextValue === null || nextValue === "") {
          return currentDisplay === ""
        }
        const parsedDisplay = Number.parseFloat(currentDisplay)
        const parsedValue =
          typeof nextValue === "number" ? nextValue : Number.parseFloat(String(nextValue))
        if (Number.isNaN(parsedDisplay) || Number.isNaN(parsedValue)) {
          return false
        }
        return parsedDisplay === parsedValue
      },
      [isIncompleteNumeric]
    )
    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      toDisplayValue(value)
    )
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => {
      if (!isNumeric) {
        return
      }
      if (isFocused || isIncompleteNumeric(displayValue)) {
        return
      }
      if (numericEqualsDisplay(value, displayValue)) {
        return
      }
      const next = toDisplayValue(value)
      if (next !== displayValue) {
        setDisplayValue(next)
      }
    }, [value, displayValue, isNumeric, isFocused, numericEqualsDisplay, toDisplayValue, isIncompleteNumeric])

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
      if (!isNumeric) {
        onChange?.(event)
        return
      }

      const nextValue = event.target.value
      if (!numericPattern.test(nextValue)) {
        return
      }

      setDisplayValue(nextValue)
      if (isIncompleteNumeric(nextValue)) {
        return
      }

      onChange?.(event)
    }

    const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
      if (isNumeric) {
        setIsFocused(true)
      }
      onFocus?.(event)
    }

    const handleBlur: React.FocusEventHandler<HTMLInputElement> = (event) => {
      if (isNumeric) {
        setIsFocused(false)
        if (!numericEqualsDisplay(value, displayValue) && !isIncompleteNumeric(displayValue)) {
          setDisplayValue(toDisplayValue(value))
        }
      }
      onBlur?.(event)
    }

    return (
      <input
        type={isNumeric ? "text" : type}
        inputMode={resolvedInputMode}
        pattern={resolvedPattern}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        ref={ref}
        value={isNumeric ? displayValue : value}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
