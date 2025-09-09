// src/utils/pagination.ts
export function getPagination(query) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { skip, take, page, pageSize };
}