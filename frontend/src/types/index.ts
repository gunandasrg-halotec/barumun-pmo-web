// ─── Auth ───────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: Role;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

export interface ActiveWbdVersion {
  id: string;
  version_number: number;
  status: string;
}

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  description?: string;
  has_active_baseline: boolean;
  active_wbd_version: ActiveWbdVersion | null;
  created_by?: { id: string; full_name: string };
  created_at?: string;
  updated_at?: string;
}

// ─── WBD ─────────────────────────────────────────────────────────────────────

export type WbdVersionStatus =
  | 'DRAFT'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'FINAL_APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export interface WbdVersion {
  id: string;
  project_id: string;
  version_number: number;
  status: WbdVersionStatus;
  is_active: boolean;
  based_on_version_id: string | null;
  submitted_by: { id: string; full_name: string } | null;
  submitted_at: string | null;
  approved_by: { id: string; full_name: string } | null;
  approved_at: string | null;
  rejected_by: { id: string; full_name: string } | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export type NodeType = 'GROUP' | 'ITEM';

export interface WbdNode {
  id: string;
  wbd_version_id: string;
  parent_node_id: string | null;
  node_type: NodeType;
  code: string;
  name: string;
  description?: string;
  unit?: string;
  volume?: number | null;
  rate?: number | null;
  planned_cost: number;
  component_percent?: number | null;
  total_percent?: number | null;
  start_date?: string | null;
  duration_days?: number | null;
  end_date?: string | null;
  status: string;
  sort_order: number;
  children?: WbdNode[];
}

// ─── Progress ────────────────────────────────────────────────────────────────

export type ProgressStatus =
  | 'DRAFT'
  | 'PENDING_PM_APPROVAL'
  | 'AUTO_APPROVED'
  | 'APPROVED'
  | 'REJECTED';

export interface ProgressEntry {
  id: string;
  project_id: string;
  wbd_node: {
    id: string;
    code: string;
    name: string;
    unit?: string;
  } | null;
  progress_date: string;
  progress_volume: number;
  note?: string;
  entered_by: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
  status: ProgressStatus;
  is_official: boolean;
  approved_by: { id: string; full_name: string } | null;
  approved_at: string | null;
  rejected_by: { id: string; full_name: string } | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  actual_costs?: ActualCostSummary[];
}

// ─── Cost ─────────────────────────────────────────────────────────────────────

export type CostStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED';

export interface ActualCostSummary {
  id: string;
  amount: number;
  status: CostStatus;
  transaction_date: string;
}

export interface ActualCostTransaction {
  id: string;
  project_id: string;
  progress_entry: {
    id: string;
    progress_date: string;
    wbd_node: { id: string; name: string } | null;
  } | null;
  amount: number;
  transaction_date: string;
  description?: string;
  entered_by: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
  status: CostStatus;
  reviewed_by: { id: string; full_name: string } | null;
  reviewed_at: string | null;
  rejected_by: { id: string; full_name: string } | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

// ─── Files ───────────────────────────────────────────────────────────────────

export type FileType = 'DOCUMENT' | 'IMAGE';
export type FileStatus = 'ACTIVE' | 'ARCHIVED';
export type RelatedEntityType = 'WBD_NODE' | 'PROGRESS_ENTRY';

export interface FileCategory {
  id: string;
  category_name: string;
  description?: string;
  is_active: boolean;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_type: FileType;
  original_file_name: string;
  mime_type: string;
  caption?: string;
  photo_date?: string;
  note?: string;
  related_entity_type?: RelatedEntityType;
  related_entity_id?: string;
  file_status: FileStatus;
  file_category: { id: string; name: string } | null;
  uploaded_by: { id: string; full_name: string } | null;
  uploaded_at: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DashboardData {
  has_baseline: boolean;
  message?: string;
  active_baseline_version?: number;
  total_baseline_cost: number;
  total_actual_cost_approved: number;
  cost_deviation: number;
  cost_deviation_percent: number;
  total_official_progress_entries: number;
  pending_progress_approval: number;
  pending_cost_review: number;
}

export interface GanttNode {
  id: string;
  parent_node_id: string | null;
  node_type: NodeType;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  planned_cost: number;
  volume: number | null;
  unit: string | null;
  status: string;
  sort_order: number;
  actual_volume: number;
  progress_percent: number;
}

export interface SCurveSeries {
  period: string;
  cumulative_volume: number;
  cumulative_cost?: number;
}

export interface CostAnalysisItem {
  id: string;
  code: string;
  name: string;
  node_type: NodeType;
  baseline_cost: number;
  actual_cost_approved: number;
  deviation: number;
  deviation_percent: number;
  weight_percent: number;
  is_over_budget: boolean;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportType = 'WEEKLY' | 'MONTHLY' | 'COST' | 'PROGRESS' | 'SUMMARY';

export interface ReportRecord {
  id: string;
  project_id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  file_path: string;
  generated_by: { id: string; full_name: string } | null;
  generated_at: string;
  status: 'FINAL' | 'DELETED';
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

// ─── Role Names ───────────────────────────────────────────────────────────────

export const ROLES = {
  ADMINISTRATOR_SISTEM: 'Administrator Sistem',
  PROJECT_MANAGER: 'Project Manager',
  DIREKSI: 'Direksi',
  FINANCE: 'Finance',
  ADMIN_PROYEK: 'Admin Proyek',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
