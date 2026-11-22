import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copies text to the clipboard and manages a timed copied indicator (`copiedKey`)
 * with automatic timer cleanup on unmount or repeated copies.
 */
export function useCopyToClipboard<K extends string = string>(defaultDurationMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<K | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCopiedKey(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string, key: K, durationMs = defaultDurationMs): Promise<boolean> => {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(text);
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
        setCopiedKey(key);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setCopiedKey(null);
        }, durationMs);
        return true;
      } catch {
        return false;
      }
    },
    [defaultDurationMs]
  );

  return { copiedKey, copy, reset };
}
