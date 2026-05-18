/**
 * Known tables in the public schema · for Backup/Restore UI.
 * Ordered by restore-safe dependency: parent tables first, child tables after.
 */

export interface TableInfo {
  name: string;
  label: string;
  group: "core" | "bca" | "cgm" | "pulse" | "leads" | "nutriscan" | "auth";
  description: string;
  /** Primary key column · used for upsert during restore. Default: "id". */
  pk?: string;
}

export const TABLES: TableInfo[] = [
  // Auth + people
  { name: "profiles",            label: "Profiles",            group: "auth", description: "User profiles · linked to auth.users · role + display_name" },
  { name: "user_app_grants",     label: "User App Grants",     group: "auth", description: "Per-user app access overrides" },

  // Core
  { name: "customers",           label: "Customers",           group: "core", description: "Master customer profiles · name · gender · DOB · height" },

  // BCA
  { name: "measurements",        label: "BCA Measurements",    group: "bca",  description: "Body composition measurements per customer" },

  // CGM
  { name: "cgm_readings",        label: "CGM Readings",        group: "cgm",  description: "Continuous glucose readings · profile_name · timestamp · value" },
  { name: "cgm_meals",           label: "CGM Meals",           group: "cgm",  description: "Meal log entries paired with CGM data" },

  // Pulse (UP Pulse)
  { name: "pulse_invites",       label: "Pulse Invites",       group: "pulse", description: "Invite tokens for customer onboarding" },
  { name: "pulse_connections",   label: "Pulse Connections",   group: "pulse", description: "Wearable OAuth connections (Google Fit · encrypted tokens)" },
  { name: "pulse_readings",      label: "Pulse Readings",      group: "pulse", description: "Wearable-sourced biomarker readings" },
  { name: "pulse_intakes",       label: "Pulse Intakes",       group: "pulse", description: "5-Q clinical intake form responses" },
  { name: "pulse_assessments",   label: "Pulse Assessments",   group: "pulse", description: "AI-generated Pulse assessments + shareable reports" },

  // Health Check / Lead capture
  { name: "healthcheck_leads",   label: "Health Check Leads",  group: "leads", description: "Public quiz submissions · risk scores · contact info" },
  { name: "checkform_records",   label: "Check FORM Records",  group: "leads", description: "F·O·R·M qualification records · scores + notes + verdict · per coach" },

  // NutriScan
  { name: "nutriscan_scans",     label: "NutriScan Scans",     group: "nutriscan", description: "AI food analysis · macros · glucose impact" },
];

export const TABLE_NAMES = TABLES.map((t) => t.name);

/** Auth users live in the auth schema and need admin API instead of regular query. */
export const AUTH_USERS_KEY = "auth.users";
