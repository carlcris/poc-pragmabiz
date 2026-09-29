"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatInches, parseInches } from "@/lib/framing/formatInches";

type FractionInputProps = {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * A number field that accepts what the shop actually writes — "1/2", "15 1/2",
 * "8 11/16" — as well as plain decimals.
 *
 * Keeps the raw text while typing, because a value is not parseable half-way
 * through ("1/" is on the way to "1/2") and reformatting on each keystroke
 * fights the operator. The parsed number is committed as soon as the text is
 * valid, so the preview and pricing stay live; the display is normalised to
 * fraction notation on blur.
 *
 * Unparseable text leaves the last good value alone rather than falling back to
 * zero, which is what `Number("1/2")` did before and is the worst outcome here:
 * a silently zeroed quantity or dimension prices the line wrongly.
 */
export function FractionInput({
  value,
  onCommit,
  className,
  id,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: FractionInputProps) {
  const [text, setText] = useState(() => (value ? formatInches(value) : ""));
  const [focused, setFocused] = useState(false);

  // Track external changes (a restored line, a reset) unless the operator is
  // mid-edit, where overwriting their keystrokes would be maddening.
  useEffect(() => {
    if (focused) return;
    setText(value ? formatInches(value) : "");
  }, [value, focused]);

  return (
    <Input
      id={id}
      className={className}
      // `numeric` hides the slash on mobile keypads; `text` keeps fractions typable.
      inputMode="text"
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = parseInches(next);
        if (parsed !== null) onCommit(parsed);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseInches(text);
        // Snap the display to the shop's own notation, or restore the last good
        // value when what is left in the box is not a measurement.
        setText(parsed !== null ? formatInches(parsed) : value ? formatInches(value) : "");
      }}
    />
  );
}
