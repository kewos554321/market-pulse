import { useCallback, useEffect, useRef, useState } from 'react';

export function useStableListHeight<T>(pageItems: T[]) {
  const listRef = useRef<HTMLDivElement>(null);
  const [listMinHeight, setListMinHeight] = useState(0);

  useEffect(() => {
    if (listRef.current) {
      const h = listRef.current.scrollHeight;
      setListMinHeight((prev) => Math.max(prev, h));
    }
    // pageItems identity changes only when page or underlying array changes (usePagination uses useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems]);

  const resetHeight = useCallback(() => setListMinHeight(0), []);

  return { listRef, listMinHeight, resetHeight };
}
