import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  queryParams?: Record<string, string | undefined>;
}

export function Pagination({ currentPage, totalPages, baseUrl, queryParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        params.set(key, val);
      }
    });
    params.set("page", page.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="mt-stack-lg flex items-center justify-end gap-stack-md">
      <span className="font-label text-caption uppercase tracking-[0.05em] text-secondary">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={buildUrl(currentPage - 1)}
            className="inline-flex items-center justify-center rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label text-label-md uppercase tracking-[0.05em] text-primary transition-colors duration-200 hover:bg-secondary-container hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Prev
          </Link>
        ) : (
          <span
            className="inline-flex items-center justify-center rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label text-label-md uppercase tracking-[0.05em] text-secondary opacity-40 cursor-not-allowed"
          >
            Prev
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildUrl(currentPage + 1)}
            className="inline-flex items-center justify-center rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label text-label-md uppercase tracking-[0.05em] text-primary transition-colors duration-200 hover:bg-secondary-container hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Next
          </Link>
        ) : (
          <span
            className="inline-flex items-center justify-center rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label text-label-md uppercase tracking-[0.05em] text-secondary opacity-40 cursor-not-allowed"
          >
            Next
          </span>
        )}
      </div>
    </div>
  );
}
