import update from 'immutability-helper';
import { Menu } from 'obsidian';
import { memo, useCallback } from 'preact/compat';
import { Dispatch, StateUpdater, useContext, useEffect, useState } from 'preact/hooks';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { t } from 'src/lang/helpers';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

import { getDropAction } from '../Editor/helpers';
import { GripIcon } from '../Icon/GripIcon';
import { Icon } from '../Icon/Icon';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { DataTypes, EditState, EditingState, Item, Lane, isEditing } from '../types';
import { ConfirmAction, useSettingsMenu } from './LaneMenu';
import { LaneSettings } from './LaneSettings';
import { LaneLimitCounter, LaneTitle } from './LaneTitle';

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  bindHandle: (el: HTMLElement) => void;
  setIsItemInputVisible?: Dispatch<StateUpdater<EditState>>;
  addItems?: (items: Item[]) => void;
  isCollapsed: boolean;
  toggleIsCollapsed: () => void;
}

interface LaneButtonProps {
  settingsMenu: Menu;
  editState: EditState;
  setEditState: Dispatch<StateUpdater<EditState>>;
  setIsItemInputVisible?: Dispatch<StateUpdater<EditState>>;
  addItems?: (items: Item[]) => void;
}

function LaneButtons({
  settingsMenu,
  editState,
  setEditState,
  setIsItemInputVisible,
  addItems,
}: LaneButtonProps) {
  const { stateManager } = useContext(KanbanContext);

  const handleAddCard = useCallback(async (e?: MouseEvent) => {
    console.log('[LaneHeader] === handleAddCard START ===');

    // 阻止事件冒泡，防止触发其他点击事件
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('[LaneHeader] Step 1: Checking stateManager...');
    if (!stateManager) {
      console.error('[LaneHeader] stateManager is null!');
      return;
    }

    console.log('[LaneHeader] Step 2: Reading setting...');
    try {
      // 使用 getSetting 而不是 useSetting，因为这是在回调函数中
      // useSetting 是 hook，只能在组件渲染时调用
      const useTasksPlugin = stateManager.getSetting('use-tasks-plugin');
      console.log('[LaneHeader] useTasksPlugin value:', useTasksPlugin, 'type:', typeof useTasksPlugin);

      if (useTasksPlugin && addItems) {
        console.log('[LaneHeader] Step 3: Using Tasks plugin...');
        try {
          console.log('[LaneHeader] Step 3.1: Getting app...');
          const app = stateManager.app;
          console.log('[LaneHeader] Step 3.2: app exists:', !!app);

          console.log('[LaneHeader] Step 3.3: Getting plugins...');
          const plugins = (app as any)?.plugins?.plugins;
          console.log('[LaneHeader] Step 3.4: plugins exists:', !!plugins);

          console.log('[LaneHeader] Step 3.5: Getting Tasks plugin...');
          const tasksPlugin = plugins?.['obsidian-tasks-plugin'];
          const tasksApi = tasksPlugin?.apiV1;
          console.log('[LaneHeader] tasksPlugin exists:', !!tasksPlugin, 'tasksApi exists:', !!tasksApi);

          if (tasksApi) {
            console.log('[LaneHeader] Step 4: Opening Tasks modal...');
            const taskLine = await tasksApi.createTaskLineModal();
            console.log('[LaneHeader] Step 5: Got taskLine:', taskLine);
            if (taskLine && taskLine.trim() !== '') {
              // 移除 Tasks 插件添加的复选框，因为 Kanban 会自动添加
              const cleanTaskLine = taskLine.replace(/^-\s*\[[ xX]\]\s*/, '');
              console.log('[LaneHeader] Step 6: Adding item:', cleanTaskLine);
              addItems([stateManager.getNewItem(cleanTaskLine, ' ')]);
            }
            console.log('[LaneHeader] Step 7: Tasks flow complete');
            return;
          } else {
            console.log('[LaneHeader] Tasks API not found, falling back');
          }
        } catch (error) {
          console.error('[Kanban] Failed to open Tasks modal:', error);
        }
      }

      // Fallback to default input
      console.log('[LaneHeader] Step 8: Fallback to default input, setIsItemInputVisible:', !!setIsItemInputVisible);
      if (setIsItemInputVisible) {
        setIsItemInputVisible({ x: 0, y: 0 });
      }
      console.log('[LaneHeader] === handleAddCard END ===');
    } catch (err) {
      console.error('[LaneHeader] ERROR in handleAddCard:', err);
    }
  }, [stateManager, addItems, setIsItemInputVisible]);

  return (
    <div className={c('lane-settings-button-wrapper')}>
      {isEditing(editState) ? (
        <a
          onClick={() => setEditState(null)}
          aria-label={t('Close')}
          className={`${c('lane-settings-button')} is-enabled clickable-icon`}
        >
          <Icon name="lucide-x" />
        </a>
      ) : (
        <>
          {setIsItemInputVisible && (
            <a
              aria-label={t('Add a card')}
              className={`${c('lane-settings-button')} clickable-icon`}
              onClick={(e) => {
                console.log('[LaneHeader] onClick triggered!');
                handleAddCard(e);
              }}
              onDragOver={(e) => {
                if (getDropAction(stateManager, e.dataTransfer)) {
                  handleAddCard();
                }
              }}
            >
              <Icon name="lucide-plus-circle" />
            </a>
          )}
          <a
            aria-label={t('More options')}
            className={`${c('lane-settings-button')} clickable-icon`}
            onClick={(e) => {
              settingsMenu.showAtMouseEvent(e);
            }}
          >
            <Icon name="lucide-more-vertical" />
          </a>
        </>
      )}
    </div>
  );
}

export const LaneHeader = memo(function LaneHeader({
  lane,
  laneIndex,
  bindHandle,
  setIsItemInputVisible,
  addItems,
  isCollapsed,
  toggleIsCollapsed,
}: LaneHeaderProps) {
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  const lanePath = useNestedEntityPath(laneIndex);

  const { boardModifiers } = useContext(KanbanContext);
  const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu({
    setEditState,
    path: lanePath,
    lane,
  });

  useEffect(() => {
    if (lane.data.forceEditMode) {
      setEditState(null);
    }
  }, [lane.data.forceEditMode]);

  const onLaneTitleChange = useCallback(
    (str: string) => {
      const { title, maxItems } = parseLaneTitle(str);
      boardModifiers.updateLane(
        lanePath,
        update(lane, {
          data: {
            title: { $set: title },
            maxItems: { $set: maxItems },
          },
        })
      );
    },
    [boardModifiers, lane, lanePath]
  );

  const onDoubleClick = useCallback(
    (e: MouseEvent) => {
      !isCollapsed && setEditState({ x: e.clientX, y: e.clientY });
    },
    [isCollapsed, setEditState]
  );

  return (
    <>
      <div
        // eslint-disable-next-line react/no-unknown-property
        onDblClick={onDoubleClick}
        className={c('lane-header-wrapper')}
      >
        <div className={c('lane-grip')} ref={bindHandle}>
          <GripIcon />
        </div>

        <div onClick={toggleIsCollapsed} className={c('lane-collapse')}>
          <Icon name="chevron-down" />
        </div>

        <LaneTitle
          id={lane.id}
          editState={editState}
          maxItems={lane.data.maxItems}
          onChange={onLaneTitleChange}
          setEditState={setEditState}
          title={lane.data.title}
        />

        <LaneLimitCounter
          editState={editState}
          itemCount={lane.children.length}
          maxItems={lane.data.maxItems}
        />

        <LaneButtons
          editState={editState}
          setEditState={setEditState}
          setIsItemInputVisible={setIsItemInputVisible}
          addItems={addItems}
          settingsMenu={settingsMenu}
        />
      </div>

      <LaneSettings editState={editState} lane={lane} lanePath={lanePath} />

      {confirmAction && (
        <ConfirmAction
          lane={lane}
          action={confirmAction}
          onAction={() => {
            switch (confirmAction) {
              case 'archive':
                boardModifiers.archiveLane(lanePath);
                break;
              case 'archive-items':
                boardModifiers.archiveLaneItems(lanePath);
                break;
              case 'delete':
                boardModifiers.deleteEntity(lanePath);
                break;
            }

            setConfirmAction(null);
          }}
          cancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
});
