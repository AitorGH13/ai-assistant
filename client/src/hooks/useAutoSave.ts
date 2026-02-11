import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  delay?: number;
  onSave: () => void;
  enabled?: boolean;
}

export function useAutoSave({ delay = 1000, onSave, enabled = true }: UseAutoSaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedSave = useCallback(() => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onSave();
    }, delay);
  }, [delay, onSave, enabled]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedSave;
}