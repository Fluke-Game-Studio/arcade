import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Backs a page's "active tab" state with a URL query param (default `?tab=`)
 * instead of local useState, so any link — including a notification's href —
 * can deep-link straight into a specific tab, not just the page.
 *
 * Falls back to `defaultKey` when the param is missing or isn't one of
 * `validKeys` (e.g. an old/typo'd link, or no param at all). Tab clicks use
 * `replace: true` so working through tabs doesn't spam browser history —
 * arriving via a link/notification still works exactly the same either way.
 */
export function useTabState<T extends string>(
  validKeys: readonly T[],
  defaultKey: T,
  paramName: string = "tab"
): [T, (key: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeKey = useMemo<T>(() => {
    const raw = searchParams.get(paramName);
    return raw && (validKeys as readonly string[]).includes(raw) ? (raw as T) : defaultKey;
  }, [searchParams, paramName, validKeys, defaultKey]);

  const setActiveKey = useCallback(
    (key: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(paramName, key);
          return next;
        },
        { replace: true }
      );
    },
    [paramName, setSearchParams]
  );

  return [activeKey, setActiveKey];
}
