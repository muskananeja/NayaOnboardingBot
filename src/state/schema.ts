import { CanonicalTaskId, Phase } from "../tasks/taskRegistry.js";

export type HireType = "entry" | "lateral";
export type TaskState = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "SKIPPED" | "BLOCKED";

export interface ConnectPerson {
  name: string;
  invite_sent: boolean;
  connect_done: boolean;
  added_in: "PH2" | "PH4";
}

export interface UserState {
  schema_version: string;
  hire_type: HireType;
  phase: Phase;
  last_active_task: CanonicalTaskId | null;
  progress_percent: number;
  blocked_tasks: CanonicalTaskId[];
  skipped_tasks: CanonicalTaskId[];
  task_states: Record<CanonicalTaskId, TaskState>;
  retry_counts: Partial<Record<CanonicalTaskId, number>>;
  connect_list: ConnectPerson[];
  carry_forward_flags: Record<string, boolean>;
}

export const PHASE_ORDER: Phase[] = ["PH0", "PH1", "PH2", "PH3", "PH4", "PH5"];

export const CANONICAL_TASK_IDS: CanonicalTaskId[] = [
  "P1", "P2", "P3", "P4", "P5", "P6", "P7",
  "D1", "D2", "D3", "D4",
  "W1", "W2", "W3", "W4", "W5",
  "M1", "M2", "M3", "M4", "M5", "M6", "M7",
  "S2", "S3", "S4", "S5", "S6",
  "T2", "T3", "T4", "T5", "T6",
];

export function createInitialState(hireType: HireType): UserState {
  const task_states = Object.fromEntries(
    CANONICAL_TASK_IDS.map((id) => [id, "PENDING"]),
  ) as Record<CanonicalTaskId, TaskState>;

  return {
    schema_version: "1.0.0",
    hire_type: hireType,
    phase: "PH0",
    last_active_task: null,
    progress_percent: 0,
    blocked_tasks: [],
    skipped_tasks: [],
    task_states,
    retry_counts: {},
    connect_list: [],
    carry_forward_flags: {},
  };
}
