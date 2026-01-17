/**
 * Eisenhower 象限中的任务项组件
 *
 * 新方案：使用原生 Kanban 拖拽
 * 任务仍然可拖拽，但拖拽后会更新 [eisenhower::qx] 内联字段
 */

import { memo, useCallback, useContext, useState, useEffect, useRef, useMemo } from 'preact/compat';
import classcat from 'classcat';
import { Item, Path } from 'src/components/types';
import { c } from 'src/components/helpers';
import { StateManager } from 'src/StateManager';
import { KanbanContext, SearchContext } from 'src/components/context';
import { EditState, EditingState, isEditing } from '../types';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { getTaskStatusDone } from 'src/parsers/helpers/inlineMetadata';
import { DateAndTime, RelativeDate } from '../Item/DateAndTime';
import { InlineMetadata } from '../Item/InlineMetadata';
import { Tags } from '../Item/ItemContent';
import { ItemCheckbox } from '../Item/ItemCheckbox';
import { useGetDateColorFn } from '../helpers';

interface QuadrantItemProps {
  item: Item;
  laneIndex: number;
  itemIndex: number;
  stateManager: StateManager;
  shouldMarkItemsComplete?: boolean;
}

export const QuadrantItem = memo(function QuadrantItem({
  item,
  laneIndex,
  itemIndex,
  stateManager,
  shouldMarkItemsComplete = false,
}: QuadrantItemProps) {
  const isProject = item.data.title.toLowerCase().includes('#project');
  const { boardModifiers, filePath } = useContext(KanbanContext);
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  const search = useContext(SearchContext);
  const titleRef = useRef<string | null>(null);

  // 隐藏 eisenhower 内联字段（不在渲染时显示）
  const displayTitle = useMemo(() => {
    return item.data.title.replace(/\[eisenhower::(q[1-4])\]/gi, '').trim();
  }, [item.data.title]);

  // 编辑模式中也隐藏 eisenhower 内联字段
  const displayTitleRaw = useMemo(() => {
    return item.data.titleRaw.replace(/\[eisenhower::(q[1-4])\]/gi, '').trim();
  }, [item.data.titleRaw]);

  // 获取原始路径用于更新和编辑
  const getOriginalPath = useCallback((): Path => {
    const originalLaneIndex = item.data.metadata.originalLaneIndex;
    const originalItemIndex = item.data.metadata.originalItemIndex;

    if (originalLaneIndex !== undefined && originalItemIndex !== undefined) {
      return [originalLaneIndex, originalItemIndex];
    }
    return [laneIndex, itemIndex];
  }, [item, laneIndex, itemIndex]);

  // 监听编辑状态变化，保存编辑到原始路径
  useEffect(() => {
    if (editState === EditingState.complete && titleRef.current !== null) {
      const path = getOriginalPath();
      console.log(`[Eisenhower] Saving edit for item:`, item.data.titleRaw.substring(0, 30), `path:`, path);

      // 重新添加 eisenhower 内联字段（如果存在）
      const existingEisenhowerMatch = item.data.titleRaw.match(/\[eisenhower::(q[1-4])\]/i);
      let finalContent = titleRef.current;
      if (existingEisenhowerMatch) {
        finalContent = finalContent + ` ${existingEisenhowerMatch[0]}`;
      }

      const updatedItem = stateManager.updateItemContent(item, finalContent);
      boardModifiers.updateItem(path, updatedItem);
      titleRef.current = null;
      setEditState(EditingState.cancel);
    } else if (editState === EditingState.cancel) {
      titleRef.current = null;
    }
  }, [editState, item, boardModifiers, stateManager, getOriginalPath]);

  const handleDragStart = (e: DragEvent) => {
    console.log(`[Eisenhower] Drag start triggered:`, item.data.titleRaw.substring(0, 30));

    const path = getOriginalPath();
    console.log(`[Eisenhower] Drag path:`, path);

    // 设置拖拽数据
    const dragData = JSON.stringify({
      item,
      path,
    });

    // 设置数据
    e.dataTransfer?.setData('text/plain', dragData);
    e.dataTransfer?.setData('application/json', dragData);

    // 设置拖拽效果
    e.dataTransfer!.effectAllowed = 'move';
  };

  const handleDragEnd = (e: DragEvent) => {
    console.log(`[Eisenhower] Drag end:`, item.data.titleRaw.substring(0, 30));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    // 让冒泡到 QuadrantLane 处理
    console.log(`[Eisenhower Item] Drop on item, bubbling to lane`);
  };

  const onDoubleClick = useCallback(() => {
    setEditState({ x: 0, y: 0 });
  }, []);

  const onContextMenu = useCallback((e: MouseEvent) => {
    if (isEditing(editState)) return;
    e.preventDefault();
  }, [editState]);

  const onEnter = useCallback(
    (cm: any, mod: boolean, shift: boolean) => {
      if (!allowNewLine(stateManager, mod, shift)) {
        setEditState(EditingState.complete);
        return true;
      }
    },
    [stateManager]
  );

  const onSubmit = useCallback(() => setEditState(EditingState.complete), []);

  const onEscape = useCallback(() => {
    setEditState(EditingState.cancel);
    return true;
  }, [item]);

  const isMatch = search?.query ? item.data.titleSearch.includes(search.query) : false;
  const getDateColor = useGetDateColorFn(stateManager);

  return (
    <div
      className={classcat([
        c('quadrant-item'),
        isProject && 'quadrant-item-project',
      ])}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
      onDblClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className={c('item')}>
        <div className={c('item-content-wrapper')}>
          <div className={c('item-title-wrapper')}>
            <ItemCheckbox
              item={item}
              path={[laneIndex, itemIndex]}
              shouldMarkItemsComplete={shouldMarkItemsComplete}
              stateManager={stateManager}
              boardModifiers={boardModifiers}
            />
            <div className={c('item-title')}>
              {isEditing(editState) ? (
                <div className={c('item-input-wrapper')}>
                  <MarkdownEditor
                    editState={editState}
                    className={c('item-input')}
                    onEnter={onEnter}
                    onEscape={onEscape}
                    onSubmit={onSubmit}
                    value={displayTitleRaw}
                    onChange={(update: any) => {
                      if (update.docChanged) {
                        titleRef.current = update.state.doc.toString().trim();
                      }
                    }}
                  />
                </div>
              ) : (
                <>
                  <MarkdownRenderer
                    entityId={item.id}
                    className={c('item-markdown')}
                    markdownString={displayTitle}
                    searchQuery={isMatch ? search.query : undefined}
                  />
                  <div className={c('item-metadata')}>
                    <RelativeDate item={item} stateManager={stateManager} />
                    <DateAndTime
                      item={item}
                      stateManager={stateManager}
                      filePath={filePath}
                      getDateColor={getDateColor}
                    />
                    <InlineMetadata item={item} stateManager={stateManager} />
                    <Tags tags={item.data.metadata.tags} searchQuery={isMatch ? search.query : undefined} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
