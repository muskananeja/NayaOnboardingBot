import { TASKS_BY_PHASE } from "../tasks/taskRegistry.js";
import { UserState } from "./schema.js";

const IN_PROGRESS_WEIGHT: Record<string, number> = {
  LONG_RUNNING: 0.5,
  LIGHT_LONG_RUNNING: 0.5,
  OUTCOME: 0.5,
  OUTCOME_PLUS: 0.5,
};

export function calculatePhaseProgress(state: UserState): number {
  const phaseTasks = TASKS_BY_PHASE[state.phase];
  const total = phaseTasks.length;

  const earned = phaseTasks.reduce((acc, task) => {
    const taskState = state.task_states[task.stateId];
    if (taskState === "COMPLETE") return acc + 1;
    if (taskState === "IN_PROGRESS") return acc + (IN_PROGRESS_WEIGHT[task.type] ?? 0);
    return acc;
  }, 0);

  return Math.round((earned / total) * 10000) / 100;
}

export function isPhaseUnlockEligible(state: UserState): boolean {
  if (calculatePhaseProgress(state) >= 80) {
    return true;
  }

  const phaseTasks = TASKS_BY_PHASE[state.phase];
  const milestone = phaseTasks[phaseTasks.length - 1];
  const milestoneState = state.task_states[milestone.stateId];
  return milestoneState === "IN_PROGRESS" || milestoneState === "COMPLETE" || milestoneState === "BLOCKED";
}
