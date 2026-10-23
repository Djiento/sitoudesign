"use client";

import type { AdminPageSize } from "@/lib/admin-pagination";

type AdminPaginationProps = {
  page: number;
  pageSize: AdminPageSize;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: AdminPageSize) => void;
};

export default function AdminPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: AdminPaginationProps) {
  const pageCount = Math.min(5, totalPages);
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - pageCount + 1));
  const visiblePages = Array.from({ length: pageCount }, (_, index) => firstPage + index);

  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <label>
        Lignes par page
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value) as AdminPageSize)}
        >
          {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span className="admin-pagination-summary" aria-live="polite">
        Page {page} sur {totalPages} · {total} {total === 1 ? "résultat" : "résultats"}
      </span>
      <div className="admin-pagination-actions">
        <button type="button" className="admin-quiet-button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Précédent
        </button>
        {firstPage > 1 && <span className="admin-pagination-ellipsis" aria-hidden="true">…</span>}
        {visiblePages.map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            className={`admin-quiet-button admin-pagination-page${pageNumber === page ? " is-active" : ""}`}
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === page ? "page" : undefined}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        {firstPage + pageCount - 1 < totalPages && <span className="admin-pagination-ellipsis" aria-hidden="true">…</span>}
        <button type="button" className="admin-quiet-button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Suivant
        </button>
      </div>
    </nav>
  );
}
