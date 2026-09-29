"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatFraction, parseFraction } from "@/lib/framing/pointFraction";
import type { PointFraction } from "@/lib/framing/types";

type PointFractionInputProps = {
  value: PointFraction;
  onCommit: (value: PointFraction) => void;
  className?: string;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
};

/**
 * The fraction field for flexipoints and multipoints.
 *
 * Deliberately NOT `FractionInput`. That one parses "1/2" to the number 0.5,
 * which is right for a dimension and wrong here: these components bill
 * `(numerator + denominator) x 2 x rate`, so the two integers must survive
 * separately — 0.5 cannot tell "1/2" from "2/4", and those are different money.
 *
 * It also accepts only a bare fraction. Whole numbers ("4") and mixed numbers
 * ("1 1/2") are not how the shop writes these, and `FractionInput` takes both,
 * so reusing it would let an operator enter something with no defined price.
 *
 * Text is held raw while typing — "1/" is on the way to "1/2" — and committed
 * as soon as it parses. Unparseable text restores the last good fraction on
 * blur rather than zeroing anything.
 */
export function PointFractionInput({
  value,
  onCommit,
  className,
  id,
  disabled,
  "aria-label": ariaLabel,
}: PointFractionInputProps) {
  const [text, setText] = useState(() => formatFraction(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(formatFraction(value));
  }, [value, focused]);

  return (
    <Input
      id={id}
      className={className}
      // `text`, not `numeric` — a numeric keypad hides the slash.
      inputMode="text"
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder="1/2"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = parseFraction(next);
        if (parsed !== null) onCommit(parsed);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFraction(text);
        setText(formatFraction(parsed ?? value));
      }}
    />
  );
}
