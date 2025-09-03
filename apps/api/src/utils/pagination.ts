// src/utils/pagination.ts
export function getPagination(q: any, maxLimit = 100) {
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const pageSize = Math.min(maxLimit, Math.max(1, parseInt(q.pageSize ?? "20", 10) || 20));
    const skip = (page - 1) * pageSize;
    return { page, pageSize, skip, take: pageSize };
  }
  