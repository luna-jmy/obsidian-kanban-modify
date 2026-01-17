import classcat from 'classcat';
import { ComponentChildren } from 'preact';
import { c } from 'src/components/helpers';

import { useStoredScrollState } from './ScrollStateContext';
import { Scrollable } from './Scrollable';

interface ScrollContainerProps {
  children?: ComponentChildren;
  className?: string;
  triggerTypes: string[];
  isStatic?: boolean;
  id: string;
  index?: number;
}

export function ScrollContainer({
  className,
  children,
  triggerTypes,
  isStatic,
  id,
  index,
}: ScrollContainerProps) {
  console.log('[DEBUG] ScrollContainer: Rendering', { id, index, className });
  const { setRef, scrollRef } = useStoredScrollState(id, index);

  const handleSetRef = (el: HTMLDivElement) => {
    console.log('[DEBUG] ScrollContainer: setRef called', { id, el: el ? 'exists' : 'null' });
    setRef(el);
  };

  return (
    <div ref={handleSetRef} className={classcat([className, c('scroll-container')])}>
      {isStatic ? (
        children
      ) : (
        <Scrollable scrollRef={scrollRef} triggerTypes={triggerTypes}>
          {children}
        </Scrollable>
      )}
    </div>
  );
}
