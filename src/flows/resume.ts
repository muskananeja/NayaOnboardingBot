import { TASKS_BY_PHASE } from "../tasks/taskRegistry.js";
import { UserState } from "../state/schema.js";

export interface ResumeSummary {
  phase: string;
  completed: number;
  remaining: number;
  blocked: string[];
  skipped: string[];
  suggestedNextTask: string | null;
  options: ["Resume next task", "Review checklist", "Jump to specific task"];
}

export function buildResumeSummary(state: UserState): ResumeSummary {
  const phaseTasks = TASKS_BY_PHASE[state.phase];
  const completed = phaseTasks.filter((task) => state.task_states[task.stateId] === "COMPLETE").length;

  const suggested = state.last_active_task
    ?? phaseTasks.find((task) => state.task_states[task.stateId] !== "COMPLETE")?.stateId
    ?? null;

  return {
    phase: state.phase,
    completed,
    remaining: phaseTasks.length - completed,
    blocked: state.blocked_tasks,
    skipped: state.skipped_tasks,
    suggestedNextTask: suggested,
    options: ["Resume next task", "Review checklist", "Jump to specific task"],
  };
}
