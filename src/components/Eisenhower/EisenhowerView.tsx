/**
 * Eisenhower Matrix view component.
 * Displays tasks in a 2x2 grid based on importance and urgency.
 */
import { useContext, useMemo } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { KanbanContext } from 'src/components/context';
import { c } from 'src/components/helpers';
import { DataTypes, Lane } from 'src/components/types';
import { ScrollContainer } from 'src/dnd/components/ScrollContainer';
import { EisenhowerClassification, classifyEisenhower } from 'src/helpers/eisenhowerClassifier';
import { t } from 'src/lang/helpers';

import { EisenhowerLane } from './EisenhowerLane';

interface EisenhowerViewProps {
  stateManager: StateManager;
}

export function EisenhowerView({ stateManager }: EisenhowerViewProps) {
  const boardData = stateManager.useState();
  const { view } = useContext(KanbanContext);

  // Collect all items from all lanes and preserve their original paths
  const allItemsWithPaths = useMemo(() => {
    return boardData.children.flatMap((lane: any, laneIndex: number) =>
      lane.children.map((item: any, itemIndex: number) => ({
        ...item,
        originalPath: [laneIndex, itemIndex],
      }))
    );
  }, [boardData]);

  // Classify items into four quadrants
  const rawClassified = useMemo(() => {
    return classifyEisenhower(allItemsWithPaths);
  }, [allItemsWithPaths]);

  // Enrich items with quadrant metadata for drag-and-drop "rules"
  const classified = useMemo(() => {
    const enrich = (items: any[], isImportant: boolean, isUrgent: boolean) =>
      items
        .map((item) => ({
          ...item,
          isImportant,
          isUrgent,
          isEisenhower: true,
        }))
        .sort((a, b) => {
          const aIsProject = a.data.title.toLowerCase().includes('#project');
          const bIsProject = b.data.title.toLowerCase().includes('#project');
          return (bIsProject ? 1 : 0) - (aIsProject ? 1 : 0);
        });

    return {
      q1: { ...rawClassified.q1, items: enrich(rawClassified.q1.items, true, true) },
      q2: { ...rawClassified.q2, items: enrich(rawClassified.q2.items, true, false) },
      q3: { ...rawClassified.q3, items: enrich(rawClassified.q3.items, false, true) },
      q4: { ...rawClassified.q4, items: enrich(rawClassified.q4.items, false, false) },
    } as EisenhowerClassification;
  }, [rawClassified]);

  // Get urgent days setting
  const urgentDays = (stateManager.useSetting('eisenhower-urgent-days') as number) || 3;

  // We create "virtual" lanes for the Eisenhower quadrants
  const q1Lane: Lane = {
    id: 'eisenhower-q1',
    type: DataTypes.Lane,
    accepts: [DataTypes.Item],
    data: { title: t('Important & Urgent') },
    children: classified.q1.items as any,
  };

  const q2Lane: Lane = {
    id: 'eisenhower-q2',
    type: DataTypes.Lane,
    accepts: [DataTypes.Item],
    data: { title: t('Important & Not Urgent') },
    children: classified.q2.items as any,
  };

  const q3Lane: Lane = {
    id: 'eisenhower-q3',
    type: DataTypes.Lane,
    accepts: [DataTypes.Item],
    data: { title: t('Not Important & Urgent') },
    children: classified.q3.items as any,
  };

  const q4Lane: Lane = {
    id: 'eisenhower-q4',
    type: DataTypes.Lane,
    accepts: [DataTypes.Item],
    data: { title: t('Not Important & Not Urgent') },
    children: classified.q4.items as any,
  };

  return (
    <ScrollContainer id={view.id} className={c('eisenhower-view')} triggerTypes={[DataTypes.Item]}>
      <div className={c('eisenhower-grid')}>
        {/* Q1: Important & Urgent - Do First */}
        <EisenhowerLane
          lane={q1Lane}
          laneIndex={0}
          title={t('Important & Urgent')}
          subtitle={t('Do First')}
          description={`${t('High priority')} + ${t('Due within')} ${urgentDays} ${t('days')}`}
          isImportant={true}
          isUrgent={true}
          colorClass={c('quadrant-q1')}
        />

        {/* Q2: Important & Not Urgent - Schedule */}
        <EisenhowerLane
          lane={q2Lane}
          laneIndex={1}
          title={t('Important & Not Urgent')}
          subtitle={t('Schedule')}
          description={`${t('High priority')} + ${t('No urgent deadline')}`}
          isImportant={true}
          isUrgent={false}
          colorClass={c('quadrant-q2')}
        />

        {/* Q3: Not Important & Urgent - Delegate */}
        <EisenhowerLane
          lane={q3Lane}
          laneIndex={2}
          title={t('Not Important & Urgent')}
          subtitle={t('Delegate')}
          description={`${t('Normal priority')} + ${t('Due within')} ${urgentDays} ${t('days')}`}
          isImportant={false}
          isUrgent={true}
          colorClass={c('quadrant-q3')}
        />

        {/* Q4: Not Important & Not Urgent - Don't Do */}
        <EisenhowerLane
          lane={q4Lane}
          laneIndex={3}
          title={t('Not Important & Not Urgent')}
          subtitle={t("Don't Do")}
          description={`${t('Normal priority')} + ${t('No urgent deadline')}`}
          isImportant={false}
          isUrgent={false}
          colorClass={c('quadrant-q4')}
        />
      </div>
    </ScrollContainer>
  );
}
