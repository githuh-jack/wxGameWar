import type { GameState } from './types';
import { areAdjacent, dispatch, findCityAt, panCamera, zoomCamera } from './engine';

export interface InputHandlers {
  onSelect: () => void;
  onDispatch: () => void;
}

// 绑定输入事件，返回解绑函数
// 交互模型：
//   · 单指拖拽己方城市 → 派遣兵力
//   · 单指拖拽空白区域 → 拖动地图
//   · 双指捏合 → 缩放地图
//   · 鼠标滚轮 → 缩放地图
export function bindInput(
  canvas: HTMLCanvasElement,
  getState: () => GameState,
  handlers: InputHandlers,
): () => void {
  // 活跃指针表：pointerId → 屏幕坐标
  const pointers = new Map<number, { x: number; y: number }>();
  let mode: 'idle' | 'pan' | 'dispatch' | 'pinch' = 'idle';
  let startSX = 0; // 手势起始屏幕坐标（用于判断是否为点击）
  let startSY = 0;
  let lastSX = 0; // 上一帧屏幕坐标（用于计算平移增量）
  let lastSY = 0;
  let pinchDist = 0; // 上次双指间距

  // 屏幕坐标 → 世界坐标
  const toWorld = (sx: number, sy: number) => {
    const state = getState();
    return {
      x: sx / state.camera.scale + state.camera.x,
      y: sy / state.camera.scale + state.camera.y,
    };
  };

  // 指针事件 → 屏幕坐标
  const toScreen = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const state = getState();
    if (state.status !== 'playing') return;
    const { x: sx, y: sy } = toScreen(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x: sx, y: sy });

    if (pointers.size === 1) {
      // 单指按下
      startSX = sx;
      startSY = sy;
      lastSX = sx;
      lastSY = sy;
      const world = toWorld(sx, sy);
      const city = findCityAt(state, world.x, world.y);
      if (city && city.owner === 'player') {
        // 拖拽己方城市 → 派遣模式
        mode = 'dispatch';
        state.selectedCityId = city.id;
        state.isDragging = true;
        state.dragTo = { x: world.x, y: world.y };
        handlers.onSelect();
      } else if (city) {
        // 点击非己方城市 → 仅选中查看
        mode = 'idle';
        state.selectedCityId = city.id;
        handlers.onSelect();
      } else {
        // 空白区域 → 平移模式
        mode = 'pan';
      }
    } else if (pointers.size === 2) {
      // 双指按下 → 切换到缩放模式，取消派遣
      mode = 'pinch';
      state.isDragging = false;
      state.dragTo = null;
      const pts = [...pointers.values()];
      pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    e.preventDefault();
  };

  const onMove = (e: PointerEvent) => {
    const state = getState();
    if (state.status !== 'playing') return;
    if (!pointers.has(e.pointerId)) return;
    const { x: sx, y: sy } = toScreen(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x: sx, y: sy });

    if (mode === 'dispatch' && pointers.size === 1) {
      const world = toWorld(sx, sy);
      state.dragTo = { x: world.x, y: world.y };
    } else if (mode === 'pan' && pointers.size === 1) {
      const dx = sx - lastSX;
      const dy = sy - lastSY;
      panCamera(state, dx, dy);
      lastSX = sx;
      lastSY = sy;
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const pts = [...pointers.values()];
      const newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDist > 0 && newDist > 0) {
        const factor = newDist / pinchDist;
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        zoomCamera(state, factor, cx, cy);
      }
      pinchDist = newDist;
    }

    // 鼠标悬停高亮（仅鼠标单指且非平移/缩放时）
    if (e.pointerType === 'mouse' && pointers.size <= 1 && mode !== 'pan' && mode !== 'pinch') {
      const world = toWorld(sx, sy);
      const city = findCityAt(state, world.x, world.y);
      state.hoverCityId = city ? city.id : null;
    }
  };

  const onUp = (e: PointerEvent) => {
    const state = getState();
    const wasMode = mode;
    const { x: sx, y: sy } = toScreen(e.clientX, e.clientY);
    pointers.delete(e.pointerId);

    if (wasMode === 'dispatch' && state.selectedCityId !== null) {
      // 派遣：检查松开位置是否在相邻目标城市上
      const world = toWorld(sx, sy);
      const target = findCityAt(state, world.x, world.y);
      if (target && target.id !== state.selectedCityId && areAdjacent(state, state.selectedCityId, target.id)) {
        dispatch(state, state.selectedCityId, target.id, 0.5);
        handlers.onDispatch();
      }
      state.isDragging = false;
      state.dragTo = null;
    } else if (wasMode === 'pan') {
      // 如果几乎没移动，视为点击空白 → 取消选中
      const moved = Math.hypot(sx - startSX, sy - startSY);
      if (moved < 8) {
        state.selectedCityId = null;
        handlers.onSelect();
      }
    }

    if (pointers.size === 1) {
      // 缩放结束剩一指 → 切为平移
      const [rem] = [...pointers.values()];
      lastSX = rem.x;
      lastSY = rem.y;
      mode = 'pan';
    } else if (pointers.size === 0) {
      mode = 'idle';
    }
  };

  const onWheel = (e: WheelEvent) => {
    const state = getState();
    if (state.status !== 'playing') return;
    e.preventDefault();
    const { x: sx, y: sy } = toScreen(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomCamera(state, factor, sx, sy);
  };

  const onLeave = () => {
    const state = getState();
    state.hoverCityId = null;
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
  };
}
