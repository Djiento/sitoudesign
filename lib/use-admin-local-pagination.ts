"use client";

import { useState } from "react";
import type { AdminPageSize } from "@/lib/admin-pagination";

export function useAdminLocalPagination<T>(items: readonly T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(25);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  return {
    pageItems: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    paginationProps: {
      page: currentPage,
      pageSize,
      total: items.length,
      totalPages,
      onPageChange: setPage,
      onPageSizeChange: (nextPageSize: AdminPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
      },
    },
    resetPage: () => setPage(1),
  };
}
