import { TASKS } from "../tasks/taskRegistry.js";
import { TaskState, UserState } from "./schema.js";

const TERMINAL_STATE: TaskState = "COMPLETE";

export function setTaskState(state: UserState, taskId: keyof UserState["task_states"], next: TaskState): UserState {
  const current = state.task_states[taskId];

  if (current === TERMINAL_STATE && next !== TERMINAL_STATE) {
    return state;
  }

  const taskDef = TASKS.find((t) => t.stateId === taskId);
  if (taskDef?.nonSkippable && next === "SKIPPED") {
    return state;
  }

  const nextState = {
    ...state,
    task_states: {
      ...state.task_states,
      [taskId]: next,
    },
  };

  nextState.blocked_tasks = Object.entries(nextState.task_states)
    .filter(([, value]) => value === "BLOCKED")
    .map(([id]) => id) as UserState["blocked_tasks"];

  nextState.skipped_tasks = Object.entries(nextState.task_states)
    .filter(([, value]) => value === "SKIPPED")
    .map(([id]) => id) as UserState["skipped_tasks"];

  return nextState;
}

export function openTask(state: UserState, taskId: keyof UserState["task_states"]): UserState {
  const next = state.task_states[taskId] === "PENDING" ? "IN_PROGRESS" : state.task_states[taskId];
  return {
    ...setTaskState(state, taskId, next),
    last_active_task: taskId,
  };
}
