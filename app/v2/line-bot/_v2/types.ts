/**
 * UP Labs v2 · LINE Bot shared shapes (mirror the /api/line-bot/groups response).
 * Same contract as v1 app/line-bot/_components/LineBotDashboard.tsx.
 */
export interface CustomerLite {
  id: string;
  name: string;
  gender: string | null;
  height: number | null;
  coach_id: string | null;
}

export interface GroupRow {
  id: string;
  line_group_id: string;
  customer_id: string | null;
  program_start_date: string;
  push_enabled: boolean;
  push_time: string;
  seed: number;
  created_at: string;
}

export interface LogRow {
  id: string;
  group_id: string | null;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  sent_at: string;
}
