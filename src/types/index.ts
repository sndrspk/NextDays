export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISOTimestamp = string;

export interface Task {
  id: UUID;
  title: string;
  notes: string | null;
  scheduled_date: ISODate;
  start_date: ISODate | null;
  due_date: ISODate | null;
  completed: boolean;
  completed_at: ISOTimestamp | null;
  project_id: UUID | null;
  tags: string[];
  sort_order: number;
  created_at: ISOTimestamp;
  template_id: UUID | null;
}

export interface TaskTemplate {
  id: UUID;
  title: string;
  notes: string | null;
  project_id: UUID | null;
  tags: string[];
  rrule: string;
  dtstart: ISODate;
  start_offset_days: number | null;
  due_offset_days: number | null;
  created_at: ISOTimestamp;
}

export interface Project {
  id: UUID;
  name: string;
  colour: string;
  is_personal: boolean;
  created_at: ISOTimestamp;
}

export interface CustomList {
  id: UUID;
  name: string;
  sort_order: number;
  created_at: ISOTimestamp;
}

export interface CustomListItem {
  id: UUID;
  list_id: UUID;
  title: string;
  notes: string | null;
  completed: boolean;
  sort_order: number;
  created_at: ISOTimestamp;
}
