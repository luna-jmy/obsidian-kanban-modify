/**
 * Quadrant Item component for Eisenhower Matrix view.
 * Displays a single task item within a quadrant.
 */
import { memo } from 'preact/compat';
import classcat from 'classcat';
import { Item } from 'src/components/types';
import { c } from 'src/components/helpers';
import { DraggableItem } from 'src/components/Item/Item';
import { EisenhowerPriority, EISENHOWER_PRIORITY_ICON_MAP } from 'src/types/priority';

interface QuadrantItemProps {
  item: Item;
  stateManager: any;
}

export const QuadrantItem = memo(function QuadrantItem({
  item,
  stateManager,
}: QuadrantItemProps) {
  const isProject = item.data.title.toLowerCase().includes('#project');
  const priority = item.data.metadata.priority || EisenhowerPriority.None;

  // Determine if task has dependencies
  const hasDependency = !!item.data.metadata.dependsOn;

  // Determine if task is blocked
  const isBlocked = hasDependency; // TODO: Check if dependency is incomplete

  return (
    <div
      className={classcat([
        c('quadrant-item'),
        isProject && c('quadrant-item-project'),
        isBlocked && c('quadrant-item-blocked'),
      ])}
    >
      <DraggableItem
        item={item}
        itemIndex={0}
        isStatic={false}
        shouldMarkItemsComplete={false}
      />

      {/* Priority badge */}
      {priority !== EisenhowerPriority.None && (
        <div className={c('priority-badge')} title={`Priority: ${priority}`}>
          {EISENHOWER_PRIORITY_ICON_MAP[priority]}
        </div>
      )}

      {/* Blocked indicator */}
      {isBlocked && (
        <div
          className={c('blocked-indicator')}
          title="Blocked by dependency"
        >
          ⏳
        </div>
      )}

      {/* Project tag indicator */}
      {isProject && (
        <div className={c('project-indicator')} title="Project task">
          📁
        </div>
      )}
    </div>
  );
});
