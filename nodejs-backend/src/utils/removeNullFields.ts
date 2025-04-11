export function removeNullFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== null)
  ) as Partial<T>;
}

export function removeNullFieldsFromArray<T extends object>(
  arr: T[]
): Partial<T>[] {
  return arr.map(removeNullFields);
}
