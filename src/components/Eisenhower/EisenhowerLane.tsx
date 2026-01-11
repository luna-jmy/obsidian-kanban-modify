/**
 * Eisenhower Matrix quadrant lane component.
 * Displays a list of tasks for a specific quadrant.
 */
import classcat from 'classcat';
import { useContext, useRef } from 'preact/compat';
import { DraggableItem } from 'src/components/Item/Item';
import { LaneHeader } from 'src/components/Lane/LaneHeader';
import { KanbanContext, SearchContext } from 'src/components/context';
import { c } from 'src/components/helpers';
import { DataTypes, Lane } from 'src/components/types';
import { Droppable } from 'src/dnd/components/Droppable';
import { ExplicitPathContext } from 'src/dnd/components/context';
// Helper to avoid import errors if frontmatterKey is not exported from where we expect
// (It was imported from parsers/common in the original file)
import { frontmatterKey } from 'src/parsers/common';

interface EisenhowerLaneProps {
  lane: Lane;
  laneIndex: number;
  title: string; // Used for display
  subtitle?: string;
  description?: string;
  isImportant: boolean;
  isUrgent: boolean;
  colorClass: string;
}

export function EisenhowerLane(props: EisenhowerLaneProps) {
  const { lane, colorClass } = props;
  const laneContentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const { view } = useContext(KanbanContext);
  const search = useContext(SearchContext);
  const boardView = view.useViewState(frontmatterKey);

  // No-op handlers for LaneHeader since we don't support collapsing/dragging quadrants yet
  const shimBindHandle = () => {};
  const shimToggleCollapsed = () => {};

  return (
    <div className={classcat([c('eisenhower-lane'), colorClass])}>
      <LaneHeader
        lane={lane}
        laneIndex={props.laneIndex}
        bindHandle={shimBindHandle}
        isCollapsed={false}
        toggleIsCollapsed={shimToggleCollapsed}
      />
      {props.subtitle && <div className={c('quadrant-subtitle')}>{props.subtitle}</div>}
      {props.description && <div className={c('quadrant-description')}>{props.description}</div>}

      <Droppable
        elementRef={laneContentRef}
        measureRef={measureRef} // Droppable needs a measureRef
        id={props.lane.id}
        index={props.laneIndex}
        data={
          {
            type: 'eisenhower-quadrant',
            isImportant: props.isImportant,
            isUrgent: props.isUrgent,
            laneId: props.lane.id,
            // Droppable will supply 'win' (window) if we don't, but let's be safe if types demand it
            accepts: [DataTypes.Item],
          } as any
        } // Cast to any to avoid strict type checking on custom properties if 'EntityData' is strict
      >
        <div className={c('lane-content')} ref={laneContentRef}>
          {/* We need a measure node for Droppable to calculate hitboxes. Usually the content div is enough if it wraps items. */}
          <div ref={measureRef} style={{ display: 'contents' }}>
            {/* Droppable provides EntityManagerContext, so we don't need to wrap explicitly */}
            {lane.children.map((item: any, i) => {
              // Fix search filtering: Items in Eisenhower view are clones,
              // so we must match by ID instead of object reference.
              if (search?.query) {
                let isMatch = false;
                search.items.forEach((searchItem) => {
                  if (searchItem.id === item.id) isMatch = true;
                });
                if (!isMatch) return null;
              }

              // Defensive check for path metadata to prevent rendering crashes
              if (!item.originalPath || item.originalPath.length < 2) {
                return null;
              }

              return (
                <ExplicitPathContext.Provider key={boardView + item.id} value={item.originalPath}>
                  <DraggableItem
                    item={item}
                    itemIndex={item.originalPath[1]} // Use the REAL index from the original lane
                    shouldMarkItemsComplete={false}
                    isStatic={false}
                  />
                </ExplicitPathContext.Provider>
              );
            })}
          </div>
        </div>
      </Droppable>
    </div>
  );
}
