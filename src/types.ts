export interface Task {
  id: string;
  text: string;
  done: boolean;
  recurring_id?: string | null;
  created_date: string;
  created_at: string;
  completed_at?: string | null;
  carried_from?: string | null;
  remind_at: string;
}

export interface ScheduledDay {
  date: string;
  tasks: Task[];
}

export interface EmailSettings {
  enabled: boolean;
  from: string;
  to: string;
  configured: boolean;
}

export interface BackupEntry {
  name: string;
  path: string;
  modified: string;
}

export interface WeeklyStats {
  total: number;
  done: number;
  rate: string;
  delayed: string[];
  week_start: string;
  week_end: string;
}
