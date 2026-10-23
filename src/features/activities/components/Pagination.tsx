import Link from "next/link";

import { Button } from "@/components/ui/button";

import { buildHistoryHref, type HistoryParams } from "../history";

export type PaginationProps = {
  page: number;
  pageCount: number;
  /** Current filters, preserved in the page links. */
  filters: Omit<HistoryParams, "page">;
};

const linkClass = "h-11 min-w-28 text-base";

function PageLink({ href, label, rel }: { href: string | null; label: string; rel: string }) {
  if (!href) {
    return (
      <Button variant="outline" className={linkClass} disabled aria-disabled="true">
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" className={linkClass}>
      <Link href={href} rel={rel}>
        {label}
      </Link>
    </Button>
  );
}

export function Pagination({ page, pageCount, filters }: PaginationProps) {
  const previous = page > 1 ? buildHistoryHref({ ...filters, page: page - 1 }) : null;
  const next = page < pageCount ? buildHistoryHref({ ...filters, page: page + 1 }) : null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
      <PageLink href={previous} label="Previous" rel="prev" />
      <span className="text-sm tabular-nums text-muted-foreground" aria-current="page">
        Page {page} of {pageCount}
      </span>
      <PageLink href={next} label="Next" rel="next" />
    </nav>
  );
}
