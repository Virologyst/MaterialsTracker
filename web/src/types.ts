export interface Material {
  id: number;
  name: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  limits: Record<string, number>;
  created_at: string;
}

export interface Student {
  id: string;
  name: string | null;
  created_at: string;
}

export interface GroupUsage {
  id: number;
  name: string;
  limits: Record<string, number>;
  used: Record<string, number>;
}

export interface Transaction {
  id: number;
  student_id: string;
  group_id: number;
  group_name?: string;
  student_name?: string;
  material: string;
  quantity: number;
  dispensed_at: string;
}

export interface ScanResult {
  found: boolean;
  student?: Student;
  groups?: GroupUsage[];
}

export interface ImportResult {
  created: number;
  enrolled: number;
  total: number;
}
