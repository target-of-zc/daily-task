import { useEffect, useRef, useState } from "react";
import { expandMainWindow, hideMainWindow, moveBallByDelta, quitApp, setBallPeek } from "./api";

export default function BallDock({
  pendingCount,
  dark,
}: {
  pendingCount: number;
  dark: boolean;
}) {
  const dragRef = useRef<{ startY: number; lastY: number; moved: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Node && menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    if (e.button !== 0) return;
    setMenuOpen(false);
    e.preventDefault();
    dragRef.current = { startY: e.screenY, lastY: e.screenY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    void setBallPeek(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = e.screenY - d.lastY;
    if (Math.abs(e.screenY - d.startY) > 4) {
      d.moved = true;
    }
    if (delta !== 0) {
      d.lastY = e.screenY;
      void moveBallByDelta(delta);
    }
  };

  const finish = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const d = dragRef.current;
    dragRef.current = null;
    void setBallPeek(false);
    if (d && !d.moved) {
      void expandMainWindow();
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
    void setBallPeek(true);
  };

  return (
    <div
      className={`ball-dock${dark ? " dark" : ""}`}
      onMouseEnter={() => void setBallPeek(true)}
      onMouseLeave={() => {
        if (!dragRef.current && !menuOpen) void setBallPeek(false);
      }}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      title="点击展开任务面板 · 拖动调整位置 · 右键菜单"
    >
      <div className="ball-face">
        <span className="ball-icon">📋</span>
        {pendingCount > 0 && (
          <em className="ball-badge">{pendingCount > 99 ? "99+" : pendingCount}</em>
        )}
      </div>
      {menuOpen && (
        <div
          ref={menuRef}
          className="ball-menu"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void expandMainWindow();
            }}
          >
            打开任务面板
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void hideMainWindow();
            }}
          >
            隐藏到托盘
          </button>
          <button type="button" className="danger" onClick={() => void quitApp()}>
            退出程序
          </button>
        </div>
      )}
    </div>
  );
}
