import classcat from 'classcat';
import update from 'immutability-helper';
import { JSX, createPortal, memo, useCallback, useMemo } from 'preact/compat';

import { KanbanView } from './KanbanView';
import { DraggableItem } from './components/Item/Item';
import { DraggableLane } from './components/Lane/Lane';
import { KanbanContext } from './components/context';
import { c, maybeCompleteForMove } from './components/helpers';
import { Board, DataTypes, Item, Lane } from './components/types';
import { DndContext } from './dnd/components/DndContext';
import { DragOverlay } from './dnd/components/DragOverlay';
import { Entity, Nestable } from './dnd/types';
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
  updateEntity,
} from './dnd/util/data';
import { getBoardModifiers } from './helpers/boardModifiers';
import { handleEisenhowerDrop } from './helpers/eisenhowerDragHandlers';
import KanbanPlugin from './main';
import { frontmatterKey } from './parsers/common';
import {
  getTaskStatusDone,
  getTaskStatusPreDone,
  toggleTask,
} from './parsers/helpers/inlineMetadata';

export function createApp(win: Window, plugin: KanbanPlugin) {
  return <DragDropApp win={win} plugin={plugin} />;
}

const View = memo(function View({ view }: { view: KanbanView }) {
  return createPortal(view.getPortal(), view.contentEl);
});

export function DragDropApp({ win, plugin }: { win: Window; plugin: KanbanPlugin }) {
  const views = plugin.useKanbanViews(win);
  const portals: JSX.Element[] = views.map((view) => <View key={view.id} view={view} />);

  const handleDrop = useCallback(
    (dragEntity: Entity, dropEntity: Entity) => {
      if (!dragEntity || !dropEntity) {
        return;
      }

      if (dragEntity.scopeId === 'htmldnd') {
        const data = dragEntity.getData();
        const stateManager = plugin.getStateManagerFromViewID(data.viewId, data.win);
        const dropPath = dropEntity.getPath();
        const destinationParent = getEntityFromPath(stateManager.state, dropPath.slice(0, -1));

        try {
          const items: Item[] = data.content.map((title: string) => {
            let item = stateManager.getNewItem(title, ' ');
            const isComplete = !!destinationParent?.data?.shouldMarkItemsComplete;

            if (isComplete) {
              item = update(item, { data: { checkChar: { $set: getTaskStatusPreDone() } } });
              const updates = toggleTask(item, stateManager.file);
              if (updates) {
                const [itemStrings, checkChars, thisIndex] = updates;
                const nextItem = itemStrings[thisIndex];
                const checkChar = checkChars[thisIndex];
                return stateManager.getNewItem(nextItem, checkChar);
              }
            }

            return update(item, {
              data: {
                checked: {
                  $set: !!destinationParent?.data?.shouldMarkItemsComplete,
                },
                checkChar: {
                  $set: destinationParent?.data?.shouldMarkItemsComplete
                    ? getTaskStatusDone()
                    : ' ',
                },
              },
            });
          });

          return stateManager.setState((board) => insertEntity(board, dropPath, items));
        } catch (e) {
          stateManager.setError(e);
          console.error(e);
        }

        return;
      }

      const dragPath = dragEntityData.originalPath || dragEntity.getPath();
      const dropPath = dropEntity.getPath();
      // dragEntityData comes from dragEntity.getData(), so we are good.
      const dragEntityData = dragEntity.getData();
      const dropEntityData = dropEntity.getData();
      const [, sourceFile] = dragEntity.scopeId.split(':::');
      const [, destinationFile] = dropEntity.scopeId.split(':::');

      const inDropArea =
        dropEntityData.acceptsSort && !dropEntityData.acceptsSort.includes(dragEntityData.type);

      // Handle Eisenhower quadrant/item drops
      const isEisenhowerTarget =
        dropEntityData.type === 'eisenhower-quadrant' || !!dropEntityData.isEisenhower;

      console.log('[DEBUG] DragDropApp: isEisenhowerTarget?', isEisenhowerTarget, dropEntityData);

      if (isEisenhowerTarget && dragEntityData.type === DataTypes.Item) {
        // Resolve view and window safely
        const targetWin = dragEntityData.win || dropEntityData.win || win;
        const view = plugin.getKanbanView(dragEntity.scopeId, targetWin);

        if (!view) {
          console.error('[Eisenhower Drop] Could not resolve view for drop.');
          return;
        }

        const stateManager = plugin.stateManagers.get(view.file);
        const boardModifiers = getBoardModifiers(view, stateManager);

        // dragPath should now be the REAL board path [laneIndex, itemIndex]
        // because of the ExplicitPathContext in EisenhowerLane.tsx
        const item = getEntityFromPath(stateManager.state, dragPath) as Item;
        const { isImportant, isUrgent } = dropEntityData;

        console.log('[DEBUG] DragDropApp: Processing Eisenhower drop', {
          isImportant,
          isUrgent,
          dragPath,
          itemTitle: item?.data?.title,
        });

        if (item) {
          console.log('[Eisenhower Drop] Updating:', item.data?.title?.substring(0, 30));

          // Convert {isImportant, isUrgent} to quadrant ID
          let targetQuadrant: 'q1' | 'q2' | 'q3' | 'q4';
          if (isImportant && isUrgent) {
            targetQuadrant = 'q1';
          } else if (isImportant && !isUrgent) {
            targetQuadrant = 'q2';
          } else if (!isImportant && isUrgent) {
            targetQuadrant = 'q3';
          } else {
            targetQuadrant = 'q4';
          }

          // handleEisenhowerDrop now handles the update internally
          handleEisenhowerDrop(item, dragPath, targetQuadrant, boardModifiers, stateManager);
        }

        return;
      }

      // Same board
      if (sourceFile === destinationFile) {
        const view = plugin.getKanbanView(dragEntity.scopeId, dragEntityData.win || win);
        const stateManager = plugin.stateManagers.get(
          view?.file || plugin.app.workspace.getActiveFile()
        );

        if (!stateManager) {
          console.error('[Drop] Could not resolve state manager.');
          return;
        }

        if (inDropArea) {
          dropPath.push(0);
        }

        return stateManager.setState((board) => {
          const entity = getEntityFromPath(board, dragPath);
          if (!entity) return board;

          const newBoard: Board = moveEntity(
            board,
            dragPath,
            dropPath,
            (entity) => {
              if (entity.type === DataTypes.Item) {
                const { next } = maybeCompleteForMove(
                  stateManager,
                  board,
                  dragPath,
                  stateManager,
                  board,
                  dropPath,
                  entity
                );
                return next;
              }
              return entity;
            },
            (entity) => {
              if (entity.type === DataTypes.Item) {
                const { replacement } = maybeCompleteForMove(
                  stateManager,
                  board,
                  dragPath,
                  stateManager,
                  board,
                  dropPath,
                  entity
                );
                return replacement;
              }
            }
          );

          if (entity.type === DataTypes.Lane) {
            const from = dragPath.last();
            let to = dropPath.last();

            if (from < to) to -= 1;

            const collapsedState = view.getViewState('list-collapse');
            const op = (collapsedState: boolean[]) => {
              const newState = [...collapsedState];
              newState.splice(to, 0, newState.splice(from, 1)[0]);
              return newState;
            };

            view.setViewState('list-collapse', undefined, op);

            return update<Board>(newBoard, {
              data: { settings: { 'list-collapse': { $set: op(collapsedState) } } },
            });
          }

          // Remove sorting in the destination lane
          const destinationParentPath = dropPath.slice(0, -1);
          const destinationParent = getEntityFromPath(board, destinationParentPath);

          if (destinationParent?.data?.sorted !== undefined) {
            return updateEntity(newBoard, destinationParentPath, {
              data: {
                $unset: ['sorted'],
              },
            });
          }

          return newBoard;
        });
      }

      const sourceWin = dragEntityData.win || win;
      const destWin = dropEntityData.win || win;
      const sourceView = plugin.getKanbanView(dragEntity.scopeId, sourceWin);
      const destinationView = plugin.getKanbanView(dropEntity.scopeId, destWin);

      if (!sourceView || !destinationView) return;

      const sourceStateManager = plugin.stateManagers.get(sourceView.file);
      const destinationStateManager = plugin.stateManagers.get(destinationView.file);

      sourceStateManager.setState((sourceBoard) => {
        const entity = getEntityFromPath(sourceBoard, dragPath);
        if (!entity) return sourceBoard;

        let replacementEntity: Nestable;

        destinationStateManager.setState((destinationBoard) => {
          if (inDropArea) {
            const parent = getEntityFromPath(destinationStateManager.state, dropPath);
            const shouldAppend =
              (destinationStateManager.getSetting('new-card-insertion-method') || 'append') ===
              'append';

            if (shouldAppend) dropPath.push(parent.children.length);
            else dropPath.push(0);
          }

          const toInsert: Nestable[] = [];

          if (entity.type === DataTypes.Item) {
            const { next, replacement } = maybeCompleteForMove(
              sourceStateManager,
              sourceBoard,
              dragPath,
              destinationStateManager,
              destinationBoard,
              dropPath,
              entity
            );
            replacementEntity = replacement;
            toInsert.push(next);
          } else {
            toInsert.push(entity);
          }

          if (entity.type === DataTypes.Lane) {
            const collapsedState = destinationView.getViewState('list-collapse');
            const val = sourceView.getViewState('list-collapse')[dragPath.last()];
            const op = (collapsedState: boolean[]) => {
              const newState = [...collapsedState];
              newState.splice(dropPath.last(), 0, val);
              return newState;
            };

            destinationView.setViewState('list-collapse', undefined, op);

            return update<Board>(insertEntity(destinationBoard, dropPath, toInsert), {
              data: { settings: { 'list-collapse': { $set: op(collapsedState) } } },
            });
          } else {
            return insertEntity(destinationBoard, dropPath, toInsert);
          }
        });

        if (entity.type === DataTypes.Lane) {
          const collapsedState = sourceView.getViewState('list-collapse');
          const op = (collapsedState: boolean[]) => {
            const newState = [...collapsedState];
            newState.splice(dragPath.last(), 1);
            return newState;
          };
          sourceView.setViewState('list-collapse', undefined, op);

          return update<Board>(removeEntity(sourceBoard, dragPath), {
            data: { settings: { 'list-collapse': { $set: op(collapsedState) } } },
          });
        } else {
          return removeEntity(sourceBoard, dragPath, replacementEntity);
        }
      });
    },
    [views, win, plugin]
  );

  if (portals.length)
    return (
      <DndContext win={win} onDrop={handleDrop}>
        {...portals}
        <DragOverlay>
          {(entity, styles) => {
            const [data, context] = useMemo(() => {
              if (entity.scopeId === 'htmldnd') {
                return [null, null];
              }

              const overlayData = entity.getData();
              const targetWin = overlayData?.win || win;

              const view = plugin.getKanbanView(entity.scopeId, targetWin);
              if (!view) return [null, null];

              const stateManager = plugin.stateManagers.get(view.file);
              // Use originalPath if available (for Eisenhower/virtual items)
              const path = overlayData.originalPath || entity.getPath();
              const data = getEntityFromPath(stateManager.state, path);
              console.log('[DEBUG] DragOverlay:', {
                overlayData,
                path,
                data,
                state: stateManager.state.children.length,
              });
              const boardModifiers = getBoardModifiers(view, stateManager);
              const filePath = view.file.path;

              return [
                data,
                {
                  view,
                  stateManager,
                  boardModifiers,
                  filePath,
                },
              ];
            }, [entity, win, plugin]);

            if (data?.type === DataTypes.Lane) {
              const boardView =
                context?.view.viewSettings[frontmatterKey] ||
                context?.stateManager.getSetting(frontmatterKey);
              const collapseState =
                context?.view.viewSettings['list-collapse'] ||
                context?.stateManager.getSetting('list-collapse');
              const laneIndex = entity.getPath().last();

              return (
                <KanbanContext.Provider value={context}>
                  <div
                    className={classcat([
                      c('drag-container'),
                      {
                        [c('horizontal')]: boardView !== 'list',
                        [c('vertical')]: boardView === 'list',
                      },
                    ])}
                    style={styles}
                  >
                    <DraggableLane
                      lane={data as Lane}
                      laneIndex={laneIndex}
                      isStatic={true}
                      isCollapsed={!!collapseState[laneIndex]}
                      collapseDir={boardView === 'list' ? 'vertical' : 'horizontal'}
                    />
                  </div>
                </KanbanContext.Provider>
              );
            }

            if (data?.type === DataTypes.Item) {
              return (
                <KanbanContext.Provider value={context}>
                  <div className={c('drag-container')} style={styles}>
                    <DraggableItem item={data as Item} itemIndex={0} isStatic={true} />
                  </div>
                </KanbanContext.Provider>
              );
            }

            return <div />;
          }}
        </DragOverlay>
      </DndContext>
    );
}
