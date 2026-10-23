export const ADMIN_PAGE_SIZES = [10, 25, 50, 100] as const;

export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number];

export type AdminPagination = {
  page: number;
  pageSize: AdminPageSize;
};

export function parseAdminPagination(searchParams: URLSearchParams):
  | { success: true; data: AdminPagination }
  | { success: false } {
  const rawPage = searchParams.get("page");
  const rawPageSize = searchParams.get("pageSize");
  const page = rawPage === null ? 1 : Number(rawPage);
  const pageSize = rawPageSize === null ? 25 : Number(rawPageSize);

  if (
    (rawPage !== null && !/^[1-9]\d*$/.test(rawPage)) ||
    !Number.isSafeInteger(page) ||
    (rawPageSize !== null && !/^\d+$/.test(rawPageSize)) ||
    !ADMIN_PAGE_SIZES.includes(pageSize as AdminPageSize)
  ) {
    return { success: false };
  }

  return { success: true, data: { page, pageSize: pageSize as AdminPageSize } };
}
