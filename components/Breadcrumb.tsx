import Link from "next/link";

export default function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-slate">/</span> : null}
            {isLast || !item.href ? (
              <span className="font-medium text-ink">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-slate transition-colors hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
