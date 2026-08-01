// ─── Auth ───────────────────────────────────────────────────────────────────

export interface IRole {
  value: string;
  label: string;
  cls: string;
  desc: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: Role;
  last_login_at: string;
  phone: string;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus = "ACTIVE" | "COMPLETED" | "ON_HOLD" | "CANCELLED";

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
  submissions_reset_at?: string | null;
  created_by?: { id: string; full_name: string };
  created_at?: string;
  updated_at?: string;
}

// ─── WBD ─────────────────────────────────────────────────────────────────────

export type WbdVersionStatus =
  | "DRAFT"
  | "PENDING_DIRECTOR_APPROVAL"
  | "FINAL_APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

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

export type NodeType = "GROUP" | "ITEM";

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface WbdNodePredecessor {
  id: string;
  predecessor_id: string;
  code: string;
  name: string;
  dependency_type: DependencyType;
}

export interface WbdNodeDependency {
  id: string;
  predecessor_node_id: string;
  successor_node_id: string;
  dependency_type: DependencyType;
}

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
  predecessors?: WbdNodePredecessor[];
  duration_days?: number | null;
  end_date?: string | null;
  status: string;
  sort_order: number;
  children?: WbdNode[];
}

// ─── Progress ────────────────────────────────────────────────────────────────

export type ProgressStatus =
  | "DRAFT"
  | "PENDING_PM_APPROVAL"
  | "AUTO_APPROVED"
  | "APPROVED"
  | "REJECTED";

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
  attachment_path?: string | null;
  actual_cost?: number;
  created_at: string;
  actual_costs?: ActualCostSummary[];
}

// ─── Cost ─────────────────────────────────────────────────────────────────────

export type CostStatus = "DRAFT" | "REVIEW" | "APPROVED" | "REJECTED";

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

export type FileType = "DOCUMENT" | "IMAGE";
export type FileStatus = "ACTIVE" | "ARCHIVED";
export type RelatedEntityType = "WBD_NODE" | "PROGRESS_ENTRY";

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

export type ScheduleStatus =
  | 'NO_DATA'
  | 'NOT_STARTED'
  | 'ON_TRACK'
  | 'AHEAD'
  | 'DELAYED'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE';

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
  weight_percent: number;
  actual_start_date: string | null;
  actual_end_date: string | null;
  expected_progress_percent: number | null;
  schedule_status: ScheduleStatus;
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

export type ReportType = "WEEKLY" | "MONTHLY" | "COST" | "PROGRESS" | "SUMMARY";

export interface ReportRecord {
  id: string;
  project_id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  file_path: string;
  generated_by: { id: string; full_name: string } | null;
  generated_at: string;
  status: "FINAL" | "DELETED";
}

export interface LoginResponse<T> {
  user: User;
  token: string;
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
  ADMINISTRATOR_SISTEM: "Administrator Sistem",
  PROJECT_MANAGER: "Manajer Kebun",
  DIREKSI: "Direksi",
  FINANCE: "Finance",
  ADMIN_PROYEK: "Admin Proyek",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

//  Project File -------------------

// 1. Interface untuk relasi yang opsional (Eloquent loading)
export interface FileCategoryRelation {
  id: string; // UUID
  category_name: string;
}

export interface UploadedByUserRelation {
  id: string; // UUID
  full_name: string;
}

// 2. Interface Utama untuk FileResource
export interface FileResource {
  id: string; // UUID
  project_id: string; // UUID
  file_type: FileType;
  original_file_name: string;
  mime_type: string;
  caption: string | null;
  photo_date: string | null; // Format YYYY-MM-DD
  note: string | null;
  related_entity_type: RelatedEntityType | null;
  related_entity_id: string | null; // UUID
  file_status: FileStatus;
  
  // Menggunakan tanda tanya (?) karena properti ini hanya ada jika relasi di-load (whenLoaded)
  // Dan bisa bernilai null jika relasi di-load tetapi datanya memang kosong di database
  file_category?: FileCategoryRelation | null;
  uploaded_by?: UploadedByUserRelation | null;
  
  uploaded_at: string; // ISO 8601 DateTime String (misal: "2026-07-16T03:55:58Z")
  file_size: number | null; // Bytes
  download_url: string; // URL string

}

// ─── Heavy Equipment (Penggunaan Alat Berat) ───────────────────────────────────

export interface HeavyEquipment {
  id: string;
  code: string;   // Kode Alat Berat
  type: string;   // Jenis Alat Berat
  brand: string;  // Merek Alat Berat
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HeavyEquipmentCostItem {
  id: string;
  name: string;
  default_amount: number | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export type FuelType = "solar" | "dex_lite";

export interface FuelStockReceiptEntry {
  fuel_type: FuelType;
  qty_20l: number;
  qty_30l: number;
  qty_35l: number;
  qty_40l: number;
}

export interface FuelStockLedgerEntry {
  id: string;
  entry_type: "receipt" | "usage";
  receipt_date: string;
  kebun: string | null;
  qty_20l: number;
  qty_30l: number;
  qty_35l: number;
  qty_40l: number;
  total_liters: number;
  saldo: number;
  notes: string | null;
  photos: { id: string; download_url: string }[];
}

export interface FuelStockData {
  total_received: number;
  total_used: number;
  saldo: number;
  entries: FuelStockLedgerEntry[];
}

export interface FuelStock {
  solar: FuelStockData;
  dex_lite: FuelStockData;
}

export interface HeavyEquipmentActivityTypeConfig {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  allow_date_range: boolean;
  has_description: boolean;
  has_repair_cost: boolean;
  sort_order: number;
  is_active: boolean;
}

/** @deprecated Gunakan HeavyEquipmentActivityTypeConfig dari API */
export interface HeavyEquipmentActivityOption {
  value: string;
  label: string;
  unit: string | null;
  allow_date_range?: boolean;
}

export const AREA_OPTIONS = ["TM", "TBM"] as const;

export interface HeavyEquipmentLogActivity {
  id?: string;
  activity_type: string;
  label?: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time: string | null;
  end_time: string | null;
  volume: number | null;
  unit: string | null;
  description?: string | null;
  repair_cost?: number | null;
}

export interface HeavyEquipmentLogCost {
  id?: string;
  cost_item_id: string;
  name?: string | null;
  amount: number;
}

export interface HeavyEquipmentLogPhoto {
  id: string;
  original_file_name: string;
  mime_type: string;
  photo_date: string | null;
  download_url: string;
}

export interface HeavyEquipmentLog {
  id: string;
  equipment?: { id: string; code: string; type: string; brand: string } | null;
  log_date: string;
  kebun: string;
  area: string | null;
  operator: string;
  kenek: string | null;
  fuel_liters: number | null;
  fuel_liters_dex_lite: number | null;
  work_morning_start: string | null;
  work_morning_end: string | null;
  work_afternoon_start: string | null;
  work_afternoon_end: string | null;
  note: string | null;
  source: string;
  total_cost: number;
  activities?: HeavyEquipmentLogActivity[];
  costs?: HeavyEquipmentLogCost[];
  photos?: HeavyEquipmentLogPhoto[];
  created_at?: string;
}

export interface HeavyEquipmentAnalytics {
  summary: {
    total_days: number;
    total_fuel_liters: number;
    total_meter: number;
    total_pokok: number;
    total_work_hours: number;
    total_cost: number;
    cost_per_meter: number | null;
    cost_per_pokok: number | null;
    cost_per_day: number | null;
  };
  daily_series: Array<{
    date: string;
    fuel_liters: number;
    cost: number;
    meter: number;
    pokok: number;
    cumulative_fuel: number;
    cumulative_cost: number;
  }>;
  by_activity: Array<{
    activity_type: string;
    label: string;
    unit: string | null;
    total_volume: number;
    total_hours: number;
    entry_count: number;
    total_cost: number;
    cost_per_unit: number | null;
    cost_per_hour: number | null;
    speed_per_hour: number | null;
  }>;
  activity_daily_series: Array<Record<string, number | string>>;
  activity_daily_types: Array<{ value: string; label: string; unit: string | null }>;
  by_equipment: Array<{
    equipment: { id: string; code: string; type: string; brand: string } | null;
    days: number;
    fuel_liters: number;
    cost: number;
  }>;
  by_cost_item: Array<{ name: string; total: number }>;
}