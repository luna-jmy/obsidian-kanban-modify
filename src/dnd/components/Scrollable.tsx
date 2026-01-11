import { RefObject, useContext, useEffect, useMemo, useRef } from 'preact/compat';
import { useOnMount } from 'src/components/helpers';

import { ScrollManager } from '../managers/ScrollManager';
import { WithChildren } from '../types';
import { DndManagerContext, ScopeIdContext, ScrollManagerContext } from './context';

interface ScrollContextProps extends WithChildren {
  scrollRef: RefObject<HTMLElement | null>;
  triggerTypes?: string[];
}

export function Scrollable({ scrollRef, triggerTypes, children }: ScrollContextProps) {
  const dndManager = useContext(DndManagerContext);
  const scopeId = useContext(ScopeIdContext);
  const parentScrollManager = useContext(ScrollManagerContext);

  const managerRef = useRef<ScrollManager>();
  console.log('[DEBUG] Scrollable: render', {
    hasDndManager: !!dndManager,
    hasRef: !!scrollRef.current,
  });

  const scrollManager = useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new ScrollManager(
        dndManager,
        scopeId,
        triggerTypes || ([] as string[]),
        parentScrollManager
      );

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [dndManager, scopeId, scrollRef, triggerTypes, parentScrollManager]);

  useEffect(() => {
    let frameId: number;
    let initialized = false;

    const attemptInit = () => {
      if (initialized) return;

      if (scrollRef.current && managerRef.current) {
        console.log('[DEBUG] Scrollable: Calling initNodes on manager', {
          node: scrollRef.current,
          manager: managerRef.current,
        });
        managerRef.current.initNodes(scrollRef.current);
        initialized = true;
      } else {
        // console.log('[DEBUG] Scrollable: Waiting for ref or manager...');
        frameId = requestAnimationFrame(attemptInit);
      }
    };

    attemptInit();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      managerRef.current?.destroy();
    };
  }, [scrollRef, scrollManager]);

  if (!scrollManager) {
    return null;
  }

  return (
    <ScrollManagerContext.Provider value={scrollManager}>{children}</ScrollManagerContext.Provider>
  );
}
