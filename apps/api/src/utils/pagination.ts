// src/utils/pagination.ts
import { ParsedQs } from "qs";

export function getPagination(query: ParsedQs) {
  const pageRaw = query.page;
  const pageSizeRaw = query.pageSize;

  const page = typeof pageRaw === 'string' ? parseInt(pageRaw) : 1;
  const pageSize = typeof pageSizeRaw === 'string' ? parseInt(pageSizeRaw) : 20;

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  return { skip, take, page, pageSize };
}