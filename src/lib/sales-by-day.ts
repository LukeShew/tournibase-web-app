export type SalesByDay = {
  date: string;
  totalRevenue: number;
};

export function selectSalesByDay(
  days: SalesByDay[],
  limit = 7,
): SalesByDay[] {
  if (limit <= 0) {
    return [];
  }

  return [...days]
    .sort(
      (left, right) =>
        right.totalRevenue - left.totalRevenue ||
        left.date.localeCompare(right.date),
    )
    .slice(0, limit)
    .sort((left, right) => left.date.localeCompare(right.date));
}
