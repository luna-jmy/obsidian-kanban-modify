/**
 * Quadrant Lane component for Eisenhower Matrix view.
 * Displays a single quadrant with its items.
 */
import { memo, useContext, useEffect, useMemo, useRef } from 'preact/compat';
import { useMemo as useDndMemo } from 'preact/hooks';
import { c } from 'src/components/helpers';
import { DataTypes, Item } from 'src/components/types';
import {
  DndManagerContext,
  ScopeIdContext,
  ScrollManagerContext,
} from 'src/dnd/components/context';
import { EntityManager } from 'src/dnd/managers/EntityManager';
import { EisenhowerDropData } from 'src/helpers/eisenhowerDragHandlers';

import { QuadrantItem } from './QuadrantItem';

interface QuadrantLaneProps {
  title: string;
  subtitle: string;
  description: string;
  items: Item[];
  isImportant: boolean;
  isUrgent: boolean;
  colorClass: string;
  onDrop?: (item: Item) => void;
  stateManager: any;
}

// Internal component that manages the drop zone
const QuadrantLaneInner = memo(function QuadrantLaneInner({
  title,
  subtitle,
  description,
  items,
  isImportant,
  isUrgent,
  colorClass,
  stateManager,
}: QuadrantLaneProps) {
  const quadrantRef = useRef<HTMLDivElement>(null);
  const dndManager = useContext(DndManagerContext);
  const scopeId = useContext(ScopeIdContext);
  const parentScrollManager = useContext(ScrollManagerContext);

  // Create drop data for this quadrant
  const dropData: EisenhowerDropData & { type: string; accepts: string[] } = {
    type: 'eisenhower-quadrant',
    accepts: [DataTypes.Item], // Crucial: allow items to be dropped here
    isImportant,
    isUrgent,
  };

  const dataRef = useRef(dropData);
  dataRef.current = dropData;

  // Create entity manager for this quadrant
  const entityManager = useDndMemo(() => {
    if (dndManager && quadrantRef.current) {
      const manager = new EntityManager(
        dndManager,
        scopeId,
        `quadrant-${isImportant}-${isUrgent}`, // Unique ID for this quadrant
        0,
        undefined,
        parentScrollManager,
        undefined,
        dataRef
      );

      // Initialize with the quadrant element
      manager.initNodes(quadrantRef.current, quadrantRef.current);

      return manager;
    }

    return null;
  }, [dndManager, scopeId, isImportant, isUrgent, parentScrollManager]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      entityManager?.destroy();
    };
  }, [entityManager]);

  // Sort items: project tasks (#project) come first
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aHasProject = a.data.title.toLowerCase().includes('#project');
      const bHasProject = b.data.title.toLowerCase().includes('#project');
      if (aHasProject && !bHasProject) return -1;
      if (!aHasProject && bHasProject) return 1;

      // Then sort by priority (highest to lowest)
      const priorityOrder = { highest: 5, high: 4, medium: 3, none: 2, low: 1, lowest: 0 };
      const aPriority = (a.data.metadata.priority as keyof typeof priorityOrder) || 'none';
      const bPriority = (b.data.metadata.priority as keyof typeof priorityOrder) || 'none';
      return priorityOrder[bPriority] - priorityOrder[aPriority];
    });
  }, [items]);

  return (
    <div
      ref={quadrantRef}
      className={`${c('quadrant-lane')} ${colorClass}`}
      data-quadrant-is-important={isImportant}
      data-quadrant-is-urgent={isUrgent}
    >
      <div className={c('quadrant-header')}>
        <h3 className={c('quadrant-title')}>
          <span className={c('quadrant-title-text')}>{title}</span>
          <span className={c('quadrant-subtitle')}>{subtitle}</span>
          <span className={c('quadrant-count')}>{items.length}</span>
        </h3>
        <p className={c('quadrant-description')}>{description}</p>
      </div>

      <div className={c('quadrant-items')}>
        {sortedItems.length === 0 ? (
          <div className={c('quadrant-empty')}>
            <span className={c('quadrant-empty-text')}>No tasks</span>
          </div>
        ) : (
          sortedItems.map((item, index) => (
            <QuadrantItem key={item.id} item={item} itemIndex={index} stateManager={stateManager} />
          ))
        )}
      </div>
    </div>
  );
});

export const QuadrantLane = memo(function QuadrantLane(props: QuadrantLaneProps) {
  // Wrap with EntityManager context if dndManager is available
  return <QuadrantLaneInner {...props} />;
});
