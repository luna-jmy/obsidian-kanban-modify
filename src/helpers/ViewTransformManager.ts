import update from 'immutability-helper';

import { KanbanFormat, LaneMapping } from '../Settings';
import { Board, Lane, DataTypes } from '../components/types';
import { StateManager } from '../StateManager';

export interface ViewDefinition {
  type: KanbanFormat;
  virtualLanes: string[];
  icons?: string[];
}

export const EISENHOWER_VIEW: ViewDefinition = {
  type: 'eisenhower',
  virtualLanes: [
    '重要且紧急 🔴',
    '重要不紧急 🟢',
    '不重要但紧急 🟡',
    '不重要不紧急 ⚪',
  ],
};

export const GTD_VIEW: ViewDefinition = {
  type: 'gtd',
  virtualLanes: [
    '收集箱 📥',
    '处理中 🔄',
    '等待/授权 ⏳',
    '已完成 ✅',
  ],
};

export class ViewTransformManager {
  constructor(private stateManager: StateManager) {}

  private getCurrentMapping(): LaneMapping[] {
    return this.stateManager.getSetting('lane-mapping') || [];
  }

  private async saveMapping(mapping: LaneMapping[]): Promise<void> {
    const board = this.stateManager.state;
    this.stateManager.setState(
      update(board, {
        data: {
          settings: {
            'lane-mapping': { $set: mapping },
          },
        },
      })
    );
  }

  async transformToView(targetView: KanbanFormat, board: Board): Promise<Board> {
    const currentView = this.stateManager.getSetting('kanban-plugin') || 'board';

    if (this.isVirtualView(currentView) && !this.isVirtualView(targetView)) {
      return this.restoreOriginalHeaders(board);
    }

    if (!this.isVirtualView(currentView) && this.isVirtualView(targetView)) {
      return this.applyVirtualHeaders(targetView, board);
    }

    if (this.isVirtualView(currentView) && this.isVirtualView(targetView)) {
      const restored = await this.restoreOriginalHeaders(board);
      return this.applyVirtualHeaders(targetView, restored);
    }

    return board;
  }

  private isVirtualView(view: KanbanFormat): boolean {
    return view === 'eisenhower' || view === 'gtd';
  }

  private async restoreOriginalHeaders(board: Board): Promise<Board> {
    const mapping = this.getCurrentMapping();

    if (mapping.length === 0) {
      return board;
    }

    const virtualToOriginal = new Map<string, string>();
    mapping.forEach((m) => {
      virtualToOriginal.set(m.virtual, m.original);
    });

    const restoredLanes = board.children.map((lane) => {
      const originalName = virtualToOriginal.get(lane.data.title);
      if (originalName) {
        return update(lane, {
          data: {
            title: { $set: originalName },
          },
        });
      }
      return lane;
    });

    await this.saveMapping([]);

    return update(board, {
      children: {
        $set: restoredLanes,
      },
    });
  }

  private async applyVirtualHeaders(targetView: KanbanFormat, board: Board): Promise<Board> {
    const viewDef = this.getViewDefinition(targetView);
    if (!viewDef) return board;

    const ensuredBoard = await this.ensureLaneCount(targetView, board);

    const mapping: LaneMapping[] = ensuredBoard.children.map((lane, index) => ({
      original: lane.data.title,
      virtual: viewDef.virtualLanes[index] || lane.data.title,
    }));

    await this.saveMapping(mapping);

    const transformedLanes = ensuredBoard.children.map((lane, index) =>
      update(lane, {
        data: {
          title: {
            $set: viewDef.virtualLanes[index] || lane.data.title,
          },
        },
      })
    );

    return update(ensuredBoard, {
      children: {
        $set: transformedLanes,
      },
    });
  }

  private getViewDefinition(view: KanbanFormat): ViewDefinition | null {
    switch (view) {
      case 'eisenhower':
        return EISENHOWER_VIEW;
      case 'gtd':
        return GTD_VIEW;
      default:
        return null;
    }
  }

  async ensureLaneCount(targetView: KanbanFormat, board: Board): Promise<Board> {
    const viewDef = this.getViewDefinition(targetView);
    if (!viewDef) return board;

    const requiredCount = viewDef.virtualLanes.length;
    const currentCount = board.children.length;

    if (currentCount >= requiredCount) {
      return update(board, {
        children: {
          $set: board.children.slice(0, requiredCount),
        },
      });
    }

    const newLanes: Lane[] = [...board.children];
    for (let i = currentCount; i < requiredCount; i++) {
      const timestamp = Date.now();
      newLanes.push({
        id: 'lane-' + timestamp + '-' + i,
        type: DataTypes.Lane,
        accepts: [DataTypes.Item],
        data: {
          title: viewDef.virtualLanes[i],
          shouldMarkItemsComplete: false,
        },
        children: [],
      });
    }

    return update(board, {
      children: {
        $set: newLanes,
      },
    });
  }

  getOriginalLaneName(virtualName: string): string {
    const mapping = this.getCurrentMapping();
    const found = mapping.find((m) => m.virtual === virtualName);
    return found ? found.original : virtualName;
  }

  getVirtualLaneName(originalName: string): string {
    const mapping = this.getCurrentMapping();
    const found = mapping.find((m) => m.original === originalName);
    return found ? found.virtual : originalName;
  }

  isInVirtualView(): boolean {
    const currentView = this.stateManager.getSetting('kanban-plugin') || 'board';
    return this.isVirtualView(currentView);
  }
}
