export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== 'object' || value === null) {
    return value as DeepReadonly<T>
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return (Object.isFrozen(value) ? value : Object.freeze(value)) as DeepReadonly<T>
}
