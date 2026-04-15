export type Phase = "PH0" | "PH1" | "PH2" | "PH3" | "PH4" | "PH5";
export type TaskType =
  | "ACTION"
  | "LONG_RUNNING"
  | "LIGHT_LONG_RUNNING"
  | "OUTCOME"
  | "OUTCOME_PLUS"
  | "EVENT"
  | "MILESTONE";

export type DependencyStrength = "STRONG" | "WEAK" | "DEDUP";

export interface Dependency {
  taskId: CanonicalTaskId;
  strength: DependencyStrength;
}

export type CanonicalTaskId =
  | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7"
  | "D1" | "D2" | "D3" | "D4"
  | "W1" | "W2" | "W3" | "W4" | "W5"
  | "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7"
  | "S2" | "S3" | "S4" | "S5" | "S6"
  | "T2" | "T3" | "T4" | "T5" | "T6";

export interface TaskDefinition {
  displayId: string;
  stateId: CanonicalTaskId;
  title: string;
  phase: Phase;
  type: TaskType;
  dependencies: Dependency[];
  nonSkippable?: boolean;
}

export const TASKS: TaskDefinition[] = [
  { displayId: "P1", stateId: "P1", title: "Check Welcome Email", phase: "PH0", type: "ACTION", dependencies: [] },
  { displayId: "P2", stateId: "P2", title: "Confirm IT Access", phase: "PH0", type: "ACTION", dependencies: [{ taskId: "P1", strength: "STRONG" }] },
  { displayId: "P3", stateId: "P3", title: "Join Teams Channels", phase: "PH0", type: "ACTION", dependencies: [{ taskId: "P2", strength: "STRONG" }] },
  { displayId: "P4", stateId: "P4", title: "Review Org + CAS Overview", phase: "PH0", type: "ACTION", dependencies: [{ taskId: "P3", strength: "WEAK" }] },
  { displayId: "P5", stateId: "P5", title: "Draft Intro Email", phase: "PH0", type: "ACTION", dependencies: [{ taskId: "P4", strength: "WEAK" }] },
  { displayId: "P6", stateId: "P6", title: "Create Bio Draft", phase: "PH0", type: "ACTION", dependencies: [{ taskId: "P4", strength: "WEAK" }, { taskId: "P5", strength: "WEAK" }] },
  { displayId: "P7", stateId: "P7", title: "Review Coffee Connect List", phase: "PH0", type: "ACTION", dependencies: [{ taskId: "P4", strength: "WEAK" }] },

  { displayId: "D1", stateId: "D1", title: "Meet Buddy", phase: "PH1", type: "ACTION", dependencies: [] },
  { displayId: "D2", stateId: "D2", title: "Meet Coach", phase: "PH1", type: "ACTION", dependencies: [{ taskId: "D1", strength: "WEAK" }] },
  { displayId: "D3", stateId: "D3", title: "Confirm System Access", phase: "PH1", type: "ACTION", dependencies: [{ taskId: "P2", strength: "DEDUP" }] },
  { displayId: "D4", stateId: "D4", title: "Submit Manual of Me", phase: "PH1", type: "ACTION", dependencies: [{ taskId: "D3", strength: "WEAK" }] },

  { displayId: "W1", stateId: "W1", title: "Confirm Connect List Received", phase: "PH2", type: "ACTION", dependencies: [{ taskId: "P7", strength: "WEAK" }] },
  { displayId: "W2", stateId: "W2", title: "Review MoM Profiles", phase: "PH2", type: "ACTION", dependencies: [{ taskId: "W1", strength: "WEAK" }] },
  { displayId: "W3", stateId: "W3", title: "Select 3-5 People", phase: "PH2", type: "ACTION", dependencies: [{ taskId: "W1", strength: "STRONG" }] },
  { displayId: "W4", stateId: "W4", title: "Draft and Send Invites", phase: "PH2", type: "ACTION", dependencies: [{ taskId: "W3", strength: "STRONG" }] },
  { displayId: "W5", stateId: "W5", title: "Complete First 1-2 Connects", phase: "PH2", type: "OUTCOME", dependencies: [{ taskId: "W4", strength: "STRONG" }] },

  { displayId: "M1", stateId: "M1", title: "Weekly Connects — Buddy + Coach", phase: "PH3", type: "LONG_RUNNING", dependencies: [{ taskId: "D1", strength: "WEAK" }, { taskId: "D2", strength: "WEAK" }] },
  { displayId: "M2", stateId: "M2", title: "Symphony Setup + Walkthrough", phase: "PH3", type: "ACTION", dependencies: [{ taskId: "D3", strength: "STRONG" }] },
  { displayId: "M3", stateId: "M3", title: "Attend 1 Priority Team Meeting", phase: "PH3", type: "ACTION", dependencies: [] },
  { displayId: "M4", stateId: "M4", title: "Review Core CAS Content", phase: "PH3", type: "LONG_RUNNING", dependencies: [{ taskId: "D3", strength: "WEAK" }] },
  { displayId: "M5", stateId: "M5", title: "Create One-Slider Profile", phase: "PH3", type: "ACTION", dependencies: [{ taskId: "P6", strength: "WEAK" }] },
  { displayId: "M6", stateId: "M6", title: "Engage with CAS Tools", phase: "PH3", type: "ACTION", dependencies: [{ taskId: "M2", strength: "STRONG" }] },
  { displayId: "M7", stateId: "M7", title: "30-Day Survey + Check-in", phase: "PH3", type: "MILESTONE", dependencies: [{ taskId: "M1", strength: "WEAK" }], nonSkippable: true },

  { displayId: "S1", stateId: "M1", title: "Continue Weekly Connects", phase: "PH4", type: "LONG_RUNNING", dependencies: [{ taskId: "M1", strength: "DEDUP" }] },
  { displayId: "S2", stateId: "S2", title: "Complete Remaining Connects", phase: "PH4", type: "OUTCOME", dependencies: [{ taskId: "W5", strength: "DEDUP" }] },
  { displayId: "S3", stateId: "S3", title: "Deliver Storefront Presentation", phase: "PH4", type: "OUTCOME", dependencies: [{ taskId: "M4", strength: "WEAK" }] },
  { displayId: "S4", stateId: "S4", title: "Join or Shadow Internal Project", phase: "PH4", type: "OUTCOME", dependencies: [{ taskId: "M1", strength: "WEAK" }] },
  { displayId: "S5", stateId: "S5", title: "Balanced Scorecard Discussion", phase: "PH4", type: "OUTCOME", dependencies: [{ taskId: "M1", strength: "WEAK" }] },
  { displayId: "S6", stateId: "S6", title: "60-Day Survey + Check-in", phase: "PH4", type: "MILESTONE", dependencies: [{ taskId: "M1", strength: "WEAK" }], nonSkippable: true },

  { displayId: "T1", stateId: "M1", title: "Continue Weekly Connects", phase: "PH5", type: "LONG_RUNNING", dependencies: [{ taskId: "M1", strength: "DEDUP" }] },
  { displayId: "T2", stateId: "T2", title: "Perform in Independent Project Role", phase: "PH5", type: "OUTCOME_PLUS", dependencies: [{ taskId: "M2", strength: "STRONG" }, { taskId: "S4", strength: "WEAK" }] },
  { displayId: "T3", stateId: "T3", title: "Participate in Priority Team Forums", phase: "PH5", type: "LIGHT_LONG_RUNNING", dependencies: [{ taskId: "M3", strength: "WEAK" }] },
  { displayId: "T4", stateId: "T4", title: "Attend Consulting Connect", phase: "PH5", type: "EVENT", dependencies: [] },
  { displayId: "T5", stateId: "T5", title: "Request + Receive Coach Feedback", phase: "PH5", type: "OUTCOME", dependencies: [{ taskId: "M1", strength: "WEAK" }] },
  { displayId: "T6", stateId: "T6", title: "90-Day Survey + Plan", phase: "PH5", type: "MILESTONE", dependencies: [{ taskId: "M1", strength: "WEAK" }], nonSkippable: true },
];

export const TASKS_BY_PHASE: Record<Phase, TaskDefinition[]> = {
  PH0: TASKS.filter((t) => t.phase === "PH0"),
  PH1: TASKS.filter((t) => t.phase === "PH1"),
  PH2: TASKS.filter((t) => t.phase === "PH2"),
  PH3: TASKS.filter((t) => t.phase === "PH3"),
  PH4: TASKS.filter((t) => t.phase === "PH4"),
  PH5: TASKS.filter((t) => t.phase === "PH5"),
};
