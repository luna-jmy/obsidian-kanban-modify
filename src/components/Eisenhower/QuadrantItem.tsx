/**
 * Quadrant Item component for Eisenhower Matrix view.
 * Displays a single task item within a quadrant.
 */
import classcat from 'classcat';
import { memo, useCallback, useContext, useRef } from 'preact/compat';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ItemCheckbox } from 'src/components/Item/ItemCheckbox';
import { ItemContent } from 'src/components/Item/ItemContent';
import { useItemMenu } from 'src/components/Item/ItemMenu';
import { ItemMenuButton } from 'src/components/Item/ItemMenuButton';
import { ItemMetadata } from 'src/components/Item/MetadataTable';
import { KanbanContext, SearchContext } from 'src/components/context';
import { c } from 'src/components/helpers';
import { EditState, EditingState, Item, isEditing } from 'src/components/types';
import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { DndManagerContext } from 'src/dnd/components/context';
import { useDragHandle } from 'src/dnd/managers/DragManager';
import { EISENHOWER_PRIORITY_ICON_MAP, EisenhowerPriority } from 'src/types/priority';

interface QuadrantItemProps {
  item: Item;
  itemIndex: number;
  stateManager: any;
}

interface QuadrantItemInnerProps {
  item: Item;
  itemIndex: number;
  stateManager: any;
  isMatch?: boolean;
  searchQuery?: string;
}

const QuadrantItemInner = memo(function QuadrantItemInner({
  item,
  itemIndex,
  stateManager,
  isMatch,
  searchQuery,
}: QuadrantItemInnerProps) {
  const { boardModifiers } = useContext(KanbanContext);
  const dndManager = useContext(DndManagerContext);
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);

  const path = useNestedEntityPath(itemIndex);

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setEditState: setEditState,
    stateManager,
    path,
  });

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      if (isEditing(editState)) return;
      showItemMenu(e);
    },
    [showItemMenu, editState]
  );

  const onDoubleClick = useCallback(
    (e: MouseEvent) => setEditState({ x: e.clientX, y: e.clientY }),
    [setEditState]
  );

  const isProject = item.data.title.toLowerCase().includes('#project');
  const priority = item.data.metadata.priority || EisenhowerPriority.None;
  const hasDependency = !!item.data.metadata.dependsOn;
  const isBlocked = hasDependency;

  const ignoreAttr = useMemo(() => {
    if (isEditing(editState)) {
      return {
        'data-ignore-drag': true,
      };
    }
    return {};
  }, [editState]);

  // Handle drag start to cancel edit mode
  useEffect(() => {
    const handler = () => {
      if (isEditing(editState)) setEditState(EditingState.cancel);
    };

    dndManager.dragManager.emitter.on('dragStart', handler);
    return () => {
      dndManager.dragManager.emitter.off('dragStart', handler);
    };
  }, [dndManager, editState]);

  // Handle force edit mode
  useEffect(() => {
    if (item.data.forceEditMode) {
      setEditState({ x: 0, y: 0 });
    }
  }, [item.data.forceEditMode]);

  const shouldMarkItemsComplete = false;

  return (
    <div
      className={classcat([
        c('quadrant-item'),
        isProject && c('quadrant-item-project'),
        isBlocked && c('quadrant-item-blocked'),
      ])}
      onContextMenu={onContextMenu}
      onDblClick={onDoubleClick}
      {...ignoreAttr}
    >
      <div className={c('item-content-wrapper')} {...ignoreAttr}>
        <div className={c('item-title-wrapper')} {...ignoreAttr}>
          <ItemCheckbox
            boardModifiers={boardModifiers}
            item={item}
            path={path}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            stateManager={stateManager}
          />
          <ItemContent
            item={item}
            searchQuery={isMatch ? searchQuery : undefined}
            setEditState={setEditState}
            editState={editState}
            isStatic={false}
          />
          <ItemMenuButton
            editState={editState}
            setEditState={setEditState}
            showMenu={showItemMenu}
          />
        </div>
        <ItemMetadata searchQuery={isMatch ? searchQuery : undefined} item={item} />
      </div>

      {/* Priority badge */}
      {priority !== EisenhowerPriority.None && (
        <div className={c('priority-badge')} title={`Priority: ${priority}`}>
          {EISENHOWER_PRIORITY_ICON_MAP[priority]}
        </div>
      )}

      {/* Blocked indicator */}
      {isBlocked && (
        <div className={c('blocked-indicator')} title="Blocked by dependency">
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

export const QuadrantItem = memo(function QuadrantItem({
  item,
  itemIndex,
  stateManager,
}: QuadrantItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const search = useContext(SearchContext);

  const bindHandle = useDragHandle(measureRef, measureRef);

  const isMatch = search?.query ? item.data.titleSearch.includes(search.query) : false;

  return (
    <div
      ref={(el) => {
        measureRef.current = el;
        bindHandle(el);
      }}
      className={c('item-wrapper')}
    >
      <div ref={elementRef}>
        <Droppable
          elementRef={elementRef}
          measureRef={measureRef}
          id={item.id}
          index={itemIndex}
          data={item}
        >
          <QuadrantItemInner
            item={item}
            itemIndex={itemIndex}
            stateManager={stateManager}
            isMatch={isMatch}
            searchQuery={search?.query}
          />
        </Droppable>
      </div>
    </div>
  );
});
