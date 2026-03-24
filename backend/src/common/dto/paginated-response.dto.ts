/** 페이징된 목록 응답 공통 형태 */
export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  hasNextPage: boolean;
}

export function toPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  limit: number,
  offset: number,
): PaginatedResponse<T> {
  return {
    data,
    totalCount,
    hasNextPage: offset + limit < totalCount,
  };
}
