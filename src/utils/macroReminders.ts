import { getEventsOnDate } from "../data/usMacroCalendar";
import { cstYmd, subtractBeijingMinutes } from "./timezone";

export interface MacroAlertSlot {
  id: string;
  name: string;
  alertAt: string;
  eventAt: string;
}

/** 今日宏观事件，提前 5 分钟的提醒时刻（东八区 HH:MM） */
export function buildTodayMacroAlertSlots(): MacroAlertSlot[] {
  const cst = cstYmd();
  const events = getEventsOnDate(cst.year, cst.month, cst.day);
  return events.map((e) => {
    const { hm } = subtractBeijingMinutes(e.beijingDate, e.beijingTime, 5);
    return {
      id: e.id,
      name: e.name,
      alertAt: hm,
      eventAt: e.beijingTime,
    };
  });
}
