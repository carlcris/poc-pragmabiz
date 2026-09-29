"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Names the group for screen readers — the options alone are ambiguous. */
  "aria-label": string;
  className?: string;
};

/**
 * A pill toggle: a filled track with the selected option raised out of it.
 *
 * Unlike a row of buttons, the track makes it obvious the options are the two
 * halves of one choice, and unlike `Switch` it names both sides — which matters
 * when neither is an "off" state.
 *
 * Rendered as a radiogroup rather than buttons so arrow keys move between the
 * options, which is what a keyboard user expects of a segmented choice.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const select = (index: number) => onChange(options[index].value);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select((index + 1) % options.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select((index - 1 + options.length) % options.length);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary p-1",
        className
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Only the selected option is tabbable; arrow keys move within the
            // group, so a tab lands on the group rather than each option.
            tabIndex={selected ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-primary",
              selected
                ? "bg-background text-primary shadow-sm"
                : "text-primary-foreground hover:bg-primary-foreground/10"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
