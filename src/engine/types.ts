import { CanonicalTaskId, Phase } from "../tasks/taskRegistry.js";
import { UserState } from "../state/schema.js";

// A single user-facing option in a bot turn
export interface BotOption {
  key: string;       // e.g. "A", "B", "C", "D"
  label: string;     // displayed text
}

// What the bot emits each turn
export interface FlowResult {
  message: string;
  options: BotOption[];
  newState: UserState;
  // If set, auto-advance to this task after user acknowledges
  autoAdvanceTask?: CanonicalTaskId;
  // If set, the current phase is complete — show summary then unlock next
  phaseComplete?: boolean;
  // Internal step to resume this task at next turn
  nextStep?: string;
}

// Input to any task flow handler
export interface FlowInput {
  state: UserState;
  step: string;          // current step within the task (default "MAIN")
  choice?: string;       // user's selected option key ("A", "B", etc.)
  textInput?: string;    // free-text entry (name lists, etc.)
}

// Type for a task flow function
export type TaskFlowFn = (input: FlowInput) => FlowResult;

// Phase labels for display
export const PHASE_LABELS: Record<Phase, string> = {
  PH0: "Pre-Onboarding",
  PH1: "Day 1",
  PH2: "Week 1",
  PH3: "30-Day",
  PH4: "60-Day",
  PH5: "90-Day",
};

// Standard options reused across flows
export const OPT_BACK_CHECKLIST: BotOption = { key: "C", label: "View checklist" };
export const OPT_SKIP: BotOption = { key: "D", label: "Skip for now" };
export const OPT_BLOCKED: BotOption = { key: "A", label: "Mark as BLOCKED" };
export const OPT_TRY_AGAIN: BotOption = { key: "B", label: "I'll try again" };
