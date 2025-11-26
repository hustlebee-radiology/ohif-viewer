export function debounceAutosave(callback: (value: string) => void, delayMs: number = 10000) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (value: string) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    const next = value.trim();
    if (!next) {
      return;
    }

    timeoutId = setTimeout(() => {
      callback(next);
    }, delayMs);
  };
}
