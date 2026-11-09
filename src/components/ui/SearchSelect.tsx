"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Option } from "@/lib/types";
import { inputClass } from "./FormField";

interface SearchSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  "aria-label"?: string;
}

/** Every word typed must appear in the label (so "std 3m" finds "SC-STD-3M — Standard 3.0m"). */
function matches(label: string, query: string) {
  const text = label.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

/**
 * Dropdown with a search box. The list is rendered in a fixed-position layer on <body>,
 * so it is not clipped by scrolling tables. Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  onBlur,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "No matches",
  disabled,
  hasError,
  id,
  "aria-label": ariaLabel,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => (query ? options.filter((o) => matches(o.label, query)) : options), [options, query]);

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const above = window.innerHeight - r.bottom < 280 && r.top > 280;
    setRect({ left: r.left, top: above ? r.top : r.bottom, width: Math.max(r.width, 280), above });
  };

  const close = (commitBlur = true) => {
    setOpen(false);
    setQuery("");
    if (commitBlur) onBlur?.();
  };

  const openList = () => {
    if (disabled) return;
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (option: Option) => {
    onChange(option.value);
    close();
    trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  // Keep the layer next to its trigger; close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !panel.current?.contains(t)) close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers only read refs / stable setters
  }, [open]);

  // The highlighted option stays in view while moving with the keyboard
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      trigger.current?.focus();
    } else if (e.key === "Tab") {
      close();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className={`${inputClass(hasError)} flex items-center gap-2 text-left cursor-pointer`}
      >
        <span className={`flex-1 truncate ${selected ? "" : "text-slate-400 font-normal"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panel}
            style={{ position: "fixed", left: rect.left, width: rect.width, ...(rect.above ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.top + 4 }) }}
            className="z-[100] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="relative border-b border-slate-100">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={search}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder={searchPlaceholder}
                aria-controls={listId}
                className="w-full h-9 pl-8 pr-8 text-xs focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} title="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1 text-xs">
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-slate-400">{emptyText}</li>
              ) : (
                filtered.map((o, i) => (
                  <li
                    key={o.value}
                    data-index={i}
                    role="option"
                    aria-selected={o.value === value}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${i === active ? "bg-brand-light text-brand" : "text-slate-700"}`}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && <Check className="w-3.5 h-3.5 shrink-0 text-brand" />}
                  </li>
                ))
              )}
            </ul>
            <p className="px-3 py-1.5 text-[10.5px] text-slate-400 border-t border-slate-100">
              {filtered.length} of {options.length} · ↑ ↓ to move, Enter to pick
            </p>
          </div>,
          document.body
        )}
    </>
  );
}
