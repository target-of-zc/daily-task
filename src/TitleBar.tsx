import type { MouseEvent } from "react";
import { setAlwaysOnTop, hideMainWindow, minimizeMainWindow } from "./api";
import { onWindowDragMouseDown } from "./utils/windowDrag";

export default function TitleBar({
  alwaysOnTop,
  onAlwaysOnTopChange,
}: {
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (v: boolean) => void;
}) {
  const togglePin = async () => {
    const next = !alwaysOnTop;
    await setAlwaysOnTop(next);
    onAlwaysOnTopChange(next);
  };

  const onActionMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag" onMouseDown={onWindowDragMouseDown}>
        每日任务
      </div>
      <div className="titlebar-actions" data-no-drag>
        <button
          type="button"
          className={`titlebar-btn pin${alwaysOnTop ? " on" : ""}`}
          onMouseDown={onActionMouseDown}
          onClick={() => void togglePin()}
          title={alwaysOnTop ? "取消置顶" : "窗口置顶"}
          aria-label={alwaysOnTop ? "取消置顶" : "窗口置顶"}
        >
          📌
        </button>
        <button
          type="button"
          className="titlebar-btn min"
          onMouseDown={onActionMouseDown}
          onClick={() => void minimizeMainWindow()}
          title="收到右侧（鼠标离开也会自动收起）"
          aria-label="收到右侧"
        >
          ─
        </button>
        <button
          type="button"
          className="titlebar-btn close"
          onMouseDown={onActionMouseDown}
          onClick={() => void hideMainWindow()}
          title="隐藏到托盘"
          aria-label="隐藏到托盘"
        >
          ×
        </button>
      </div>
    </div>
  );
}
