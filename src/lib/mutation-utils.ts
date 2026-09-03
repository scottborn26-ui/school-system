export function throwIfCancelled(condition: boolean, message = "Action cancelled.") {
  if (condition) {
    throw new Error(message);
  }
}

export function isCancelledMutationError(error: unknown): boolean {
  return error instanceof Error && /cancelled|canceled/i.test(error.message);
}
