import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { availableMonitors, currentMonitor } from "@tauri-apps/api/window";
import {
  getBallPos,
  listTasks,
  openPanel,
  saveBallPos,
  toggleTask,
} from "../api";
import type { Task } from "../types";
import {
  BALL_ALPHA_ACTIVE,
  BALL_ALPHA_IDLE,
  BALL_DOCK_VISIBLE,
  BALL_SIZE,
} from "../types";

const PREVIEW_W = 300;
const PREVIEW_H = 320;
const HOVER_DELAY = 280;

export default function BallWindow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dockSide, setDockSide] = useState<"left" | "right">("right");
  const [ballY, setBallY] = useState(200);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, winX: 0, winY: 0 });

  const refresh = useCallback(async () => {
    const list = await listTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = listen("tasks-updated", () => refresh());
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const dockPartial = useCallback(
    async (side: "left" | "right", y: number) => {
      const win = getCurrentWindow();
      const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
      if (!monitor) return;
      const scale = monitor.scaleFactor;
      const sw = monitor.size.width / scale;
      const x =
        side === "right" ? sw - BALL_DOCK_VISIBLE : -(BALL_SIZE - BALL_DOCK_VISIBLE);
      await win.setSize({ type: "Logical", width: BALL_SIZE, height: BALL_SIZE });
      await win.setPosition(new PhysicalPosition(x * scale, y * scale));
      setDockSide(side);
      setBallY(y);
    },
    []
  );

  const expandPreview = useCallback(async () => {
    const win = getCurrentWindow();
    const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
    if (!monitor) return;
    const scale = monitor.scaleFactor;
    const sw = monitor.size.width / scale;
    const w = PREVIEW_W;
    const h = PREVIEW_H;
    const x =
      dockSide === "right"
        ? sw - w
        : 0;
    const y = Math.max(0, ballY - (h - BALL_SIZE) / 2);
    await win.setSize({ type: "Logical", width: w, height: h });
    await win.setPosition(new PhysicalPosition(x * scale, y * scale));
    setExpanded(true);
  }, [ballY, dockSide]);

  const collapse = useCallback(async () => {
    setExpanded(false);
    await dockPartial(dockSide, ballY);
  }, [ballY, dockSide, dockPartial]);

  useEffect(() => {
    (async () => {
      const [savedY, side] = await getBallPos();
      const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
      if (!monitor) return;
      const scale = monitor.scaleFactor;
      const sh = monitor.size.height / scale;
      const y = savedY ?? Math.floor((sh - BALL_SIZE) / 2);
      const s = (side === "left" ? "left" : "right") as "left" | "right";
      setBallY(y);
      setDockSide(s);
      await dockPartial(s, y);
    })();
  }, [dockPartial]);

  const onMouseEnter = () => {
    hoverTimer.current = setTimeout(() => expandPreview(), HOVER_DELAY);
  };

  const onMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    collapse();
  };

  const onBallClick = async (e: React.MouseEvent) => {
    if (dragging.current) return;
    e.stopPropagation();
    await openPanel();
  };

  const onPointerDown = async (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".preview-item")) return;
    dragging.current = false;
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    dragStart.current = { x: e.screenX, y: e.screenY, winX: pos.x, winY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = async (e: React.PointerEvent) => {
    if (!e.buttons) return;
    const dx = e.screenX - dragStart.current.x;
    const dy = e.screenY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragging.current = true;
    const win = getCurrentWindow();
    const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
    const scale = monitor?.scaleFactor ?? 1;
    const newY = Math.max(0, dragStart.current.winY / scale + dy);
    setBallY(newY);
    await win.setPosition(
      new PhysicalPosition(dragStart.current.winX + dx, dragStart.current.winY + dy)
    );
  };

  const onPointerUp = async () => {
    if (!dragging.current) return;
    const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
    if (!monitor) return;
    const scale = monitor.scaleFactor;
    const sw = monitor.size.width / scale;
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const cx = pos.x / scale + (expanded ? PREVIEW_W : BALL_SIZE) / 2;
    const side: "left" | "right" = cx < sw / 2 ? "left" : "right";
    setDockSide(side);
    await saveBallPos(Math.round(ballY), side);
    if (expanded) await expandPreview();
    else await dockPartial(side, ballY);
    setTimeout(() => {
      dragging.current = false;
    }, 50);
  };

  const pending = tasks.filter((t) => !t.done);
  const alpha = expanded ? BALL_ALPHA_ACTIVE : BALL_ALPHA_IDLE;

  return (
    <div
      className={`ball-root ${expanded ? "expanded" : "docked"}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {expanded ? (
        <div className="preview-panel">
          <header className="preview-header">
            <span>待完成 ({pending.length})</span>
            <div className="preview-actions">
              <button type="button" onClick={() => openPanel()}>
                管理
              </button>
              <button type="button" onClick={() => collapse()}>
                ─
              </button>
            </div>
          </header>
          <div className="preview-list">
            {pending.length === 0 ? (
              <p className="preview-empty">🎉 全部完成！</p>
            ) : (
              pending.slice(0, 8).map((t) => (
                <label key={t.id} className="preview-item">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={async () => {
                      await toggleTask(t.id);
                      refresh();
                    }}
                  />
                  <span className={`prio-${t.priority}`}>{t.text}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="floating-ball"
          style={{ opacity: alpha }}
          onClick={onBallClick}
          title="打开任务清单"
        >
          <span className="ball-count">{pending.length}</span>
        </button>
      )}
    </div>
  );
}
