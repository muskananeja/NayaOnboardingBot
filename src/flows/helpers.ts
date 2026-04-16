import { UserState } from "../state/schema.js";
import { setTaskState, openTask } from "../state/transitions.js";
import { CanonicalTaskId } from "../tasks/taskRegistry.js";
import { BotOption, FlowResult } from "../engine/types.js";

export function complete(
  state: UserState,
  taskId: CanonicalTaskId,
  message: string,
  autoAdvanceTask?: CanonicalTaskId,
): FlowResult {
  const next = setTaskState(openTask(state, taskId), taskId, "COMPLETE");
  return { message, options: [], newState: next, autoAdvanceTask };
}

export function blocked(
  state: UserState,
  taskId: CanonicalTaskId,
  message: string,
  autoAdvanceTask?: CanonicalTaskId,
): FlowResult {
  const next = setTaskState(openTask(state, taskId), taskId, "BLOCKED");
  return { message, options: [], newState: next, autoAdvanceTask };
}

export function skipped(
  state: UserState,
  taskId: CanonicalTaskId,
  flag: string,
  autoAdvanceTask?: CanonicalTaskId,
): FlowResult {
  const next = setTaskState(openTask(state, taskId), taskId, "SKIPPED");
  const flagged = { ...next, carry_forward_flags: { ...next.carry_forward_flags, [flag]: true } };
  return {
    message: `Skipped. Flagged: ${flag}`,
    options: [],
    newState: flagged,
    autoAdvanceTask,
  };
}

export function inProgress(
  state: UserState,
  taskId: CanonicalTaskId,
  message: string,
  options: BotOption[],
  nextStep: string,
): FlowResult {
  const next = openTask(state, taskId);
  return { message, options, newState: next, nextStep };
}

export function prompt(
  state: UserState,
  taskId: CanonicalTaskId,
  message: string,
  options: BotOption[],
  nextStep = "MAIN",
): FlowResult {
  const next = openTask(state, taskId);
  return { message, options, newState: next, nextStep };
}

export function incrementRetry(state: UserState, taskId: CanonicalTaskId): UserState {
  const current = state.retry_counts[taskId] ?? 0;
  return { ...state, retry_counts: { ...state.retry_counts, [taskId]: current + 1 } };
}

export function getRetry(state: UserState, taskId: CanonicalTaskId): number {
  return state.retry_counts[taskId] ?? 0;
}

export function checklist(state: UserState, taskId: CanonicalTaskId, options: BotOption[]): FlowResult {
  return prompt(state, taskId, "Returning to checklist. Select an option below.", options, "MAIN");
}

export const HELP_OPTIONS: BotOption[] = [
  { key: "A", label: "Mark as BLOCKED" },
  { key: "B", label: "I'll try again" },
  { key: "C", label: "View checklist" },
];

export const SKIP_OPTION: BotOption = { key: "D", label: "Skip for now" };

export function hireType(state: UserState): "entry" | "lateral" {
  return state.hire_type;
}
