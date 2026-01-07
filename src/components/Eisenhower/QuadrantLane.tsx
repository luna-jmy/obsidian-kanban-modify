/**
 * Quadrant Lane component for Eisenhower Matrix view.
 * Displays a single quadrant with its items.
 */
import { memo, useMemo } from 'preact/compat';
import { Droppable } from 'src/dnd/components/Droppable';
import { Item, DataTypes } from 'src/components/types';
import { c } from 'src/components/helpers';
import { QuadrantItem } from './QuadrantItem';

interface QuadrantLaneProps {
  title: string;
  subtitle: string;
  description: string;
  items: Item[];
  isImportant: boolean;
  isUrgent: boolean;
  colorClass: string;
  onDrop: (item: Item) => void;
  stateManager: any;
}

export const QuadrantLane = memo(function QuadrantLane({
  title,
  subtitle,
  description,
  items,
  isImportant,
  isUrgent,
  colorClass,
  onDrop,
  stateManager,
}: QuadrantLaneProps) {
  // Sort items: project tasks (#project) come first
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aHasProject = a.data.title.toLowerCase().includes('#project');
      const bHasProject = b.data.title.toLowerCase().includes('#project');
      if (aHasProject && !bHasProject) return -1;
      if (!aHasProject && bHasProject) return 1;

      // Then sort by priority (highest to lowest)
      const priorityOrder = { 'highest': 5, 'high': 4, 'medium': 3, 'none': 2, 'low': 1, 'lowest': 0 };
      const aPriority = (a.data.metadata.priority as keyof typeof priorityOrder) || 'none';
      const bPriority = (b.data.metadata.priority as keyof typeof priorityOrder) || 'none';
      return priorityOrder[bPriority] - priorityOrder[aPriority];
    });
  }, [items]);

  return (
    <Droppable
      type={DataTypes.Lane}
      accept={[DataTypes.Item]}
      onDrop={(e: any) => {
        onDrop(e.draggedItem);
      }}
    >
      {({ isDraggingOver, dragEnteredItem }) => {
        return (
          <div
            className={`${c('quadrant-lane')} ${colorClass} ${
              isDraggingOver ? c('quadrant-lane-drag-over') : ''
            }`}
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
                  <QuadrantItem
                    key={item.id}
                    item={item}
                    stateManager={stateManager}
                  />
                ))
              )}
            </div>
          </div>
        );
      }}
    </Droppable>
  );
});
