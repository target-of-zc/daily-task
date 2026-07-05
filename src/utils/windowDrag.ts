import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent as ReactMouseEvent } from "react";

let windowDragging = false;

export function isWindowDragging() {
  return windowDragging;
}

/** 无边框窗口：在标题栏 / Header 等区域按下左键拖动 */
export function onWindowDragMouseDown(e: ReactMouseEvent) {
  if (e.button !== 0) return;
  const el = e.target as HTMLElement;
  if (el.closest("button, input, select, textarea, a, label, [data-no-drag]")) {
    return;
  }
  e.preventDefault();
  windowDragging = true;
  void getCurrentWindow()
    .startDragging()
    .finally(() => {
      windowDragging = false;
    });
}
