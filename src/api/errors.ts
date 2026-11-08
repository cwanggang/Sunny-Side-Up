// Supabase returns plain error objects ({ message, code, ... }); React Query and screens expect Error.
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return new Error(error.message);
  }
  return new Error(String(error));
}

/** Throws if a Supabase call returned an error (or no data); otherwise returns its data. */
export function unwrap<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw toError(result.error);
  if (result.data === null || result.data === undefined) throw new Error('No data returned');
  return result.data;
}

/** For calls that return nothing on success (e.g. a void RPC). */
export function check(result: { error: unknown }): void {
  if (result.error) throw toError(result.error);
}
