"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type KebabItem =
  | { label: string; href: string; danger?: boolean; icon?: LucideIcon }
  | { label: string; onClick: () => void; danger?: boolean; icon?: LucideIcon };

export default function KebabMenu({ items }: { items: KebabItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.right });
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={toggle}
        className="rounded-lg border border-border px-2 py-1.5 text-slate hover:bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
              style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)" }}
            >
              {items.map((item, i) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    {Icon ? <Icon size={16} /> : null}
                    {item.label}
                  </>
                );
                return "href" in item ? (
                  <Link
                    key={i}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm hover:bg-paper focus:bg-paper focus:outline-none ${
                      item.danger ? "text-coral-dark" : "text-ink"
                    }`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={i}
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={`flex w-full items-center gap-1.5 px-4 py-2 text-left text-sm hover:bg-paper focus:bg-paper focus:outline-none ${
                      item.danger ? "text-coral-dark" : "text-ink"
                    }`}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
