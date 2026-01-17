/**
 * Eisenhower 象限组件
 * 显示单个象限的标题、描述和任务列表
 *
 * 新方案：使用原生 Kanban 拖拽
 * 在 drop 时更新 [eisenhower::qx] 内联字段
 */

import { memo, useContext } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { KanbanContext } from 'src/components/context';
import { c } from 'src/components/helpers';
import { QuadrantItem } from './QuadrantItem';
import { EisenhowerQuadrant, handleEisenhowerDrop } from 'src/helpers/eisenhowerDragHandlers';

export interface EisenhowerQuadrant {
  items: any[];
  isImportant: boolean;
  isUrgent: boolean;
}

interface QuadrantLaneProps {
  title: string;
  description: string;
  quadrant: EisenhowerQuadrant;
  quadrantIndex: number; // 0=Q1, 1=Q2, 2=Q3, 3=Q4
  stateManager: StateManager;
}

export const QuadrantLane = memo(function QuadrantLane({
  title,
  description,
  quadrant,
  quadrantIndex,
  stateManager,
}: QuadrantLaneProps) {
  const { boardModifiers, boardData } = useContext(KanbanContext);

  // Get the "Display card checkbox" setting (shouldMarkItemsComplete)
  // This is stored per-lane in boardData.data.lanes[laneIndex].data.shouldMarkItemsComplete
  // For Eisenhower view, we'll use a global approach: check if any lane has it enabled
  const shouldMarkItemsComplete = boardData?.data.lanes?.some((lane: any) =>
    lane.data.shouldMarkItemsComplete
  ) ?? false;

  console.log(`[Eisenhower] QuadrantLane ${quadrantIndex} (${title}): items.length=${quadrant.items.length}`);

  // 象限对应的 eisenhower 标识
  const quadrantId: EisenhowerQuadrant = `q${quadrantIndex + 1}`;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault(); // Required to allow dropping
    e.dataTransfer!.dropEffect = 'move'; // Show move cursor
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(`[Eisenhower Lane] ========== Drop on Q${quadrantIndex + 1} ==========`);

    try {
      // 尝试从 dataTransfer 获取拖拽数据
      let dragData = e.dataTransfer?.getData('application/json');
      if (!dragData) {
        dragData = e.dataTransfer?.getData('text/plain');
      }

      console.log(`[Eisenhower Lane] Drag data:`, dragData?.substring(0, 200));
      if (!dragData) {
        console.log(`[Eisenhower Lane] No drag data found`);
        return;
      }

      const { item, path } = JSON.parse(dragData);
      console.log(`[Eisenhower Lane] Dropped item:`, item.data.titleRaw.substring(0, 30), `path:`, path);

      // 使用新的内联字段方案处理拖拽
      await handleEisenhowerDrop(
        item,
        path,
        quadrantId,
        boardModifiers,
        stateManager
      );

      console.log(`[Eisenhower Lane] Drop handled successfully`);
    } catch (error) {
      console.error('[Eisenhower Lane] Error:', error);
    }
    console.log(`[Eisenhower Lane] ============================================`);
  };

  return (
    <div
      className={`${c('quadrant-lane')} quadrant-q${quadrantIndex + 1}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
    >
      <div className={c('quadrant-header')}>
        <h3 className={c('quadrant-title')}>
          {title}
          <span className={c('quadrant-count')}>{quadrant.items.length}</span>
        </h3>
        <p className={c('quadrant-description')}>{description}</p>
      </div>

      <div className={c('quadrant-items')}>
        {quadrant.items.map((item, index) => (
          <QuadrantItem
            key={item.id}
            item={item}
            laneIndex={0} // 原始路径已保存在 metadata 中
            itemIndex={0} // 原始路径已保存在 metadata 中
            stateManager={stateManager}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
          />
        ))}
      </div>
    </div>
  );
});
