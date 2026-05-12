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

// At least one of {start_rrule, start_dtstart} or {due_rrule, due_dtstart}
// must be populated. The DB CHECK constraint enforces it; clients should
// treat templates that violate it as malformed.
export interface TaskTemplate {
  id: UUID;
  title: string;
  notes: string | null;
  project_id: UUID | null;
  tags: string[];
  start_rrule: string | null;
  start_dtstart: ISODate | null;
  due_rrule: string | null;
  due_dtstart: ISODate | null;
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
