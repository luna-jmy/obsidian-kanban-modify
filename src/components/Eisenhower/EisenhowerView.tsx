/**
 * Eisenhower 视图主组件
 * 显示 2x2 四象限网格
 *
 * 新方案：
 * 1. 启用视图时自动为所有任务添加 [eisenhower::qx] 内联字段
 * 2. 基于内联字段进行分类
 * 3. 拖拽时修改内联字段和对应的图标/日期属性
 */

import { useContext, useMemo, useEffect, useRef } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { KanbanContext } from 'src/components/context';
import { Lane } from 'src/components/types';
import { classifyEisenhower, sortByProject } from 'src/helpers/eisenhowerClassifier';
import { ViewTransformManager } from 'src/helpers/ViewTransformManager';
import { addEisenhowerTagsToAllItems } from 'src/helpers/eisenhowerAutoTag';
import { QuadrantLane } from './QuadrantLane';
import { c } from 'src/components/helpers';

interface EisenhowerViewProps {
  stateManager: StateManager;
}

// 标记是否已经执行过自动标记，避免重复执行
let hasAutoTagged = false;

export function EisenhowerView({ stateManager }: EisenhowerViewProps) {
  const boardData = stateManager.useState();
  const { boardModifiers } = useContext(KanbanContext);
  const autoTagRef = useRef(false);

  // 获取紧急判断天数设置
  const urgentDays = stateManager.useSetting('eisenhower-urgent-days') || 3;

  // 视图转换管理器
  const transformManager = useMemo(
    () => new ViewTransformManager(stateManager),
    [stateManager]
  );

  // 确保有 4 个 Lane
  useEffect(() => {
    const ensureLanes = async () => {
      try {
        if (!boardData || !boardData.children) return;

        const transformedBoard = await transformManager.ensureLaneCount(
          'eisenhower',
          boardData
        );

        if (transformedBoard.children.length !== boardData.children.length) {
          // TODO: 更新 boardData
          // 这需要触发 stateManager.setState
        }
      } catch (error) {
        console.error('Error ensuring lanes for Eisenhower view:', error);
      }
    };

    ensureLanes();
  }, [boardData, transformManager]);

  // 收集所有 Items (从所有 Lanes)，并保存原始路径
  const allItems = useMemo(() => {
    const items: any[] = [];
    if (boardData?.children) {
      boardData.children.forEach((lane: Lane, laneIndex: number) => {
        if (lane?.children) {
          lane.children.forEach((item: any, itemIndex: number) => {
            // 为每个 item 保存原始路径信息
            items.push({
              ...item,
              data: {
                ...item.data,
                metadata: {
                  ...item.data.metadata,
                  // 保存原始路径以便拖拽时使用
                  originalLaneIndex: laneIndex,
                  originalItemIndex: itemIndex,
                },
              },
            });
          });
        }
      });
    }
    return items;
  }, [boardData?.children]);

  // 自动为所有任务添加内联字段（只执行一次）
  useEffect(() => {
    if (autoTagRef.current || !allItems.length) return;

    console.log(`[Eisenhower] Checking for items without eisenhower tags...`);

    const updates = addEisenhowerTagsToAllItems(allItems, urgentDays);

    if (updates.length > 0) {
      console.log(`[Eisenhower] Auto-tagging ${updates.length} items with eisenhower quadrant tags`);

      // 批量更新任务
      updates.forEach(({ item, newTitleRaw }) => {
        const path = [
          item.data.metadata.originalLaneIndex,
          item.data.metadata.originalItemIndex,
        ];

        const updatedItem = {
          ...item,
          data: {
            ...item.data,
            titleRaw: newTitleRaw,
            title: newTitleRaw,
          },
        };

        boardModifiers.updateItem(path, updatedItem);
      });

      console.log(`[Eisenhower] Auto-tagging complete`);
    } else {
      console.log(`[Eisenhower] All items already have eisenhower tags`);
    }

    autoTagRef.current = true;
  }, [allItems, urgentDays, boardModifiers]);

  // 分类到四个象限（基于内联字段）
  const classified = useMemo(() => {
    const result = classifyEisenhower(allItems, urgentDays);
    console.log(`[Eisenhower] Classification result:`, {
      q1: result.q1.items.length,
      q2: result.q2.items.length,
      q3: result.q3.items.length,
      q4: result.q4.items.length,
    });
    return result;
  }, [allItems, urgentDays]);

  // 为每个象限的 Items 排序 (#project 优先)
  const sortedQuadrants = useMemo(() => ({
    q1: { ...classified.q1, items: sortByProject(classified.q1.items) },
    q2: { ...classified.q2, items: sortByProject(classified.q2.items) },
    q3: { ...classified.q3, items: sortByProject(classified.q3.items) },
    q4: { ...classified.q4, items: sortByProject(classified.q4.items) },
  }), [classified]);

  console.log(`[Eisenhower] Rendered quadrants:`, {
    q1: sortedQuadrants.q1.items.length,
    q2: sortedQuadrants.q2.items.length,
    q3: sortedQuadrants.q3.items.length,
    q4: sortedQuadrants.q4.items.length,
  });

  return (
    <div className={c('eisenhower-view')}>
      <div className={c('eisenhower-grid')}>
        {/* 第一行 */}
        <QuadrantLane
          key="q1"
          title="重要且紧急 🔴"
          description={`高优先级 + ${urgentDays}天内到期`}
          quadrant={sortedQuadrants.q1}
          quadrantIndex={0}
          stateManager={stateManager}
        />

        <QuadrantLane
          key="q2"
          title="重要不紧急 🟢"
          description="高优先级 + 无紧急截止日期"
          quadrant={sortedQuadrants.q2}
          quadrantIndex={1}
          stateManager={stateManager}
        />

        {/* 第二行 */}
        <QuadrantLane
          key="q3"
          title="不重要但紧急 🟡"
          description={`普通优先级 + ${urgentDays}天内到期`}
          quadrant={sortedQuadrants.q3}
          quadrantIndex={2}
          stateManager={stateManager}
        />

        <QuadrantLane
          key="q4"
          title="不重要不紧急 ⚪"
          description="普通优先级 + 无紧急截止日期"
          quadrant={sortedQuadrants.q4}
          quadrantIndex={3}
          stateManager={stateManager}
        />
      </div>
    </div>
  );
}
