import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputClass } from "./Modal";

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  maxItems = 6,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Pre-ranked list (most relevant first). */
  suggestions: string[];
  placeholder?: string;
  className?: string;
  maxItems?: number;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of suggestions) {
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      if (q && key === q) continue; // hide exact-match (no point suggesting what's typed)
      if (q && !key.includes(q)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= maxItems) break;
    }
    return out;
  }, [value, suggestions, maxItems]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered, highlight]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const showList = open && filtered.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        autoFocus={autoFocus}
        className={className ?? inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!showList) {
            if (e.key === "ArrowDown" && filtered.length) {
              setOpen(true);
              e.preventDefault();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(filtered.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter") {
            const pick = filtered[highlight];
            if (pick) {
              e.preventDefault();
              onChange(pick);
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
        >
          {filtered.map((s, i) => (
            <li
              key={s + i}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                // mousedown beats blur — keep focus on input
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlight ? "bg-secondary text-foreground" : "text-foreground"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
