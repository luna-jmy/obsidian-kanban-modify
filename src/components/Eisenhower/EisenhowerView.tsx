/**
 * Eisenhower 视图主组件
 * 显示 2x2 四象限网格
 *
 * 新方案：
 * 1. 启用视图时自动为所有任务添加 [eisenhower::qx] 内联字段
 * 2. 基于内联字段进行分类
 * 3. 拖拽时修改内联字段和对应的图标/日期属性
 */

import { useContext, useMemo, useEffect, useState, useCallback } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { KanbanContext } from 'src/components/context';
import { Lane } from 'src/components/types';
import { classifyEisenhower, sortByProject, checkImportance, checkUrgency } from 'src/helpers/eisenhowerClassifier';
import { ViewTransformManager } from 'src/helpers/ViewTransformManager';
import { addEisenhowerTagsToAllItems } from 'src/helpers/eisenhowerAutoTag';
import { setEisenhowerQuadrant } from 'src/helpers/eisenhowerMetadata';
import { QuadrantLane } from './QuadrantLane';
import { c } from 'src/components/helpers';
import { t } from 'src/lang/helpers';
import { ItemForm } from '../Item/ItemForm';
import { EditState, EditingState, Item } from '../types';

interface EisenhowerViewProps {
  stateManager: StateManager;
}

export function EisenhowerView({ stateManager }: EisenhowerViewProps) {
  const boardData = stateManager.useState();
  const { boardModifiers } = useContext(KanbanContext);

  // 获取紧急判断天数设置
  const urgentDays = stateManager.useSetting('eisenhower-urgent-days') || 3;

  // Lane 选择器状态
  const [selectedLaneIndex, setSelectedLaneIndex] = useState(0);
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);

  // 获取可用的 lanes 列表
  const availableLanes = useMemo(() => {
    return boardData?.children || [];
  }, [boardData?.children]);

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
    console.log(`[Eisenhower] allItems updated, count: ${items.length}`);
    return items;
  }, [boardData]);

  // 自动为所有任务添加/更新内联字段
  useEffect(() => {
    if (!allItems.length) return;

    console.log(`[Eisenhower] Checking for items that need eisenhower tag updates...`);

    const updates = addEisenhowerTagsToAllItems(allItems, urgentDays);

    if (updates.length > 0) {
      console.log(`[Eisenhower] Updating eisenhower quadrant tags for ${updates.length} items`);

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

      console.log(`[Eisenhower] Tag updates complete`);
    } else {
      console.log(`[Eisenhower] All items have correct eisenhower tags`);
    }
  }, [allItems, urgentDays]);

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

  // 添加任务到选中的 lane，并根据任务类型自动添加 [eisenhower::qx] 属性
  const addItemsToSelectedLane = useCallback(
    (items: Item[]) => {
      console.log(`[EisenhowerView] Adding ${items.length} items to lane ${selectedLaneIndex}`);

      // 为每个新任务自动分类并添加 eisenhower 标签
      const itemsWithTag = items.map((item) => {
        // 分析任务的重要性和紧急性
        const isImportant = checkImportance(item);
        const isUrgent = checkUrgency(item, urgentDays, false);

        // 确定象限
        let quadrantId: 'q1' | 'q2' | 'q3' | 'q4';
        if (isImportant && isUrgent) {
          quadrantId = 'q1';
        } else if (isImportant && !isUrgent) {
          quadrantId = 'q2';
        } else if (!isImportant && isUrgent) {
          quadrantId = 'q3';
        } else {
          quadrantId = 'q4';
        }

        console.log(`[EisenhowerView] Auto-classified task: isImportant=${isImportant}, isUrgent=${isUrgent}, quadrant=${quadrantId}`);

        // 添加 eisenhower �签到任务标题
        const titleRawWithTag = setEisenhowerQuadrant(item.data.titleRaw, quadrantId);
        return stateManager.updateItemContent(item, titleRawWithTag);
      });

      // 添加到选中的 lane
      const targetLane = availableLanes[selectedLaneIndex];
      if (targetLane) {
        const laneIndex = availableLanes.findIndex(lane => lane.id === targetLane.id);
        if (laneIndex !== -1) {
          const appendPath = [laneIndex, targetLane.children.length];
          boardModifiers.appendItems(appendPath, itemsWithTag);
          console.log(`[EisenhowerView] Added ${itemsWithTag.length} items to lane "${targetLane.data.title}"`);
        }
      }
    },
    [selectedLaneIndex, availableLanes, boardModifiers, stateManager, urgentDays]
  );

  console.log(`[Eisenhower] Rendered quadrants:`, {
    q1: sortedQuadrants.q1.items.length,
    q2: sortedQuadrants.q2.items.length,
    q3: sortedQuadrants.q3.items.length,
    q4: sortedQuadrants.q4.items.length,
  });

  return (
    <div className={c('eisenhower-view')}>
      {/* 顶部控制栏：Lane 选择器和任务添加表单 */}
      <div className={c('eisenhower-top-controls')}>
        <div className={c('eisenhower-lane-selector')}>
          <label htmlFor="eisenhower-lane-select">{t('Add to lane:')}</label>
          <select
            id="eisenhower-lane-select"
            value={selectedLaneIndex}
            onChange={(e) => setSelectedLaneIndex(parseInt(e.currentTarget.value))}
            className={c('eisenhower-lane-select')}
          >
            {availableLanes.map((lane, index) => (
              <option key={lane.id} value={index}>
                {lane.data.title || `Lane ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        <ItemForm
          addItems={addItemsToSelectedLane}
          editState={editState}
          setEditState={setEditState}
        />
      </div>

      <div className={c('eisenhower-grid')}>
        {/* 第一行 */}
        <QuadrantLane
          key="q1"
          title={t('Important & Urgent') + ' 🔴'}
          description={t('High priority + Due within {{days}} days').replace('{{days}}', String(urgentDays))}
          quadrant={sortedQuadrants.q1}
          quadrantIndex={0}
          stateManager={stateManager}
        />

        <QuadrantLane
          key="q2"
          title={t('Important & Not Urgent') + ' 🟢'}
          description={t('High priority + No urgent deadline')}
          quadrant={sortedQuadrants.q2}
          quadrantIndex={1}
          stateManager={stateManager}
        />

        {/* 第二行 */}
        <QuadrantLane
          key="q3"
          title={t('Not Important & Urgent') + ' 🟡'}
          description={t('Normal priority + Due within {{days}} days').replace('{{days}}', String(urgentDays))}
          quadrant={sortedQuadrants.q3}
          quadrantIndex={2}
          stateManager={stateManager}
        />

        <QuadrantLane
          key="q4"
          title={t('Not Important & Not Urgent') + ' ⚪'}
          description={t('Normal priority + No urgent deadline')}
          quadrant={sortedQuadrants.q4}
          quadrantIndex={3}
          stateManager={stateManager}
        />
      </div>
    </div>
  );
}
