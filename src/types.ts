export interface Task {
  id: string;
  text: string;
  done: boolean;
  recurring_id?: string | null;
  tag: string;
  priority: string;
  remind_at: string;
  carried_from?: string | null;
}

export const TAGS = ["工作", "学习", "生活", "其他"] as const;
export const PRIORITIES = ["高", "中", "低"] as const;

export interface WeeklyStats {
  total: number;
  done: number;
  rate: string;
  by_tag: Record<string, number>;
  delayed: string[];
  week_start: string;
  week_end: string;
}
