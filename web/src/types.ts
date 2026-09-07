export interface Material {
  id: number;
  name: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Unit {
  id: number;
  name: string;
  limit_type: 'individual' | 'group';
  limits: Record<string, number>;
  total_limit: number;
  groups: GroupSummary[];
  created_at: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  student_count: number;
}

export interface Group {
  id: number;
  unit_id: number;
  name: string;
  unit_name?: string;
  created_at: string;
}

export interface Student {
  id: string;
  name: string | null;
  created_at: string;
}

export interface UnitUsage {
  id: number;
  name: string;
  limit_type: 'individual' | 'group';
  limits: Record<string, number>;
  total_limit: number;
  used: Record<string, number>;
  total_used: number;
  group: { id: number; name: string } | null;
  group_used?: Record<string, number>;
  group_total_used?: number;
  _legacy?: boolean;
}

export interface Transaction {
  id: number;
  student_id: string;
  unit_id?: number;
  group_id?: number;
  group_name?: string;
  student_name?: string;
  material: string;
  quantity: number;
  dispensed_at: string;
}

export interface ScanResult {
  found: boolean;
  student?: Student;
  units?: UnitUsage[];
}

export interface ImportResult {
  created: number;
  enrolled: number;
  grouped: number;
  ungrouped: number;
  groups_created: number;
  skipped: number;
}

// Keep legacy type alias for backward compatibility
export type GroupUsage = UnitUsage;
