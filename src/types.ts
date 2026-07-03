export interface Task {
  id: string;
  text: string;
  done: boolean;
  recurring_id?: string | null;
  created_date: string;
  created_at: string;
  completed_at?: string | null;
  carried_from?: string | null;
  tag: string;
  priority: string;
  remind_at: string;
  reminded: boolean;
}

export const TAGS = ["工作", "学习", "生活", "其他"] as const;
export const PRIORITIES = ["高", "中", "低"] as const;

export const BALL_SIZE = 64;
export const BALL_DOCK_VISIBLE = Math.floor(BALL_SIZE / 3);
export const BALL_ALPHA_IDLE = 0.48;
export const BALL_ALPHA_ACTIVE = 0.92;
