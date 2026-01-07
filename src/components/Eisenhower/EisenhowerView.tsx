/**
 * Eisenhower Matrix view component.
 * Displays tasks in a 2x2 grid based on importance and urgency.
 */
import { useContext, useMemo } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { KanbanContext } from 'src/components/context';
import { classifyEisenhower } from 'src/helpers/eisenhowerClassifier';
import { handleEisenhowerDrop, applyEisenhowerUpdate } from 'src/helpers/eisenhowerDragHandlers';
import { QuadrantLane } from './QuadrantLane';
import { c } from 'src/components/helpers';
import { t } from 'src/lang/helpers';
import { Item } from 'src/components/types';

interface EisenhowerViewProps {
  stateManager: StateManager;
}

export function EisenhowerView({ stateManager }: EisenhowerViewProps) {
  const boardData = stateManager.useState();
  const { boardModifiers } = useContext(KanbanContext);

  // Collect all items from all lanes
  const allItems = useMemo(() => {
    return boardData.children.flatMap((lane) => lane.children);
  }, [boardData]);

  // Classify items into four quadrants
  const classified = useMemo(() => {
    return classifyEisenhower(allItems);
  }, [allItems]);

  // Get urgent days setting
  const urgentDays = (stateManager.useSetting('eisenhower-urgent-days') as number) || 3;

  // Handle drop to quadrant
  const handleDropToQuadrant = (isImportant: boolean, isUrgent: boolean) => {
    return (draggedItem: Item, path: number[]) => {
      // Update item priority and date based on quadrant
      const updatedItem = handleEisenhowerDrop(
        draggedItem,
        { isImportant, isUrgent },
        stateManager,
        boardModifiers
      );

      // Apply the update to the board
      applyEisenhowerUpdate(draggedItem, updatedItem, path, boardModifiers);
    };
  };

  return (
    <div className={c('eisenhower-view')}>
      <div className={c('eisenhower-grid')}>
        {/* Q1: Important & Urgent - Do First */}
        <QuadrantLane
          title={t('Important & Urgent')}
          subtitle={t('Do First')}
          description={t('High priority + Due within {{days}} days', { days: urgentDays })}
          items={classified.q1.items}
          isImportant={true}
          isUrgent={true}
          colorClass={c('quadrant-q1')}
          onDrop={handleDropToQuadrant(true, true)}
          stateManager={stateManager}
        />

        {/* Q2: Important & Not Urgent - Schedule */}
        <QuadrantLane
          title={t('Important & Not Urgent')}
          subtitle={t('Schedule')}
          description={t('High priority + No urgent deadline')}
          items={classified.q2.items}
          isImportant={true}
          isUrgent={false}
          colorClass={c('quadrant-q2')}
          onDrop={handleDropToQuadrant(true, false)}
          stateManager={stateManager}
        />

        {/* Q3: Not Important & Urgent - Delegate */}
        <QuadrantLane
          title={t('Not Important & Urgent')}
          subtitle={t('Delegate')}
          description={t('Normal priority + Due within {{days}} days', { days: urgentDays })}
          items={classified.q3.items}
          isImportant={false}
          isUrgent={true}
          colorClass={c('quadrant-q3')}
          onDrop={handleDropToQuadrant(false, true)}
          stateManager={stateManager}
        />

        {/* Q4: Not Important & Not Urgent - Don't Do */}
        <QuadrantLane
          title={t('Not Important & Not Urgent')}
          subtitle={t("Don't Do")}
          description={t('Normal priority + No urgent deadline')}
          items={classified.q4.items}
          isImportant={false}
          isUrgent={false}
          colorClass={c('quadrant-q4')}
          onDrop={handleDropToQuadrant(false, false)}
          stateManager={stateManager}
        />
      </div>
    </div>
  );
}
