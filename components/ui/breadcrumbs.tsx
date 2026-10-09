import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Inicio">
            <Home size={15} aria-hidden="true" />
          </Link>
        </li>
        {items.map((item) => (
          <li key={`${item.href ?? 'actual'}-${item.label}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight size={14} className="shrink-0 text-muted-foreground/60" aria-hidden="true" />
            {item.href ? (
              <Link href={item.href} className="rounded-md px-1 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="max-w-[16rem] truncate rounded-md px-1 py-1 font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
