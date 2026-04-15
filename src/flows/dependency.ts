import { TaskDefinition } from "../tasks/taskRegistry.js";
import { UserState } from "../state/schema.js";

export interface DependencyWarning {
  kind: "STRONG" | "WEAK" | "DEDUP";
  message: string;
}

export function getDependencyWarning(state: UserState, task: TaskDefinition): DependencyWarning | null {
  const firstDependency = task.dependencies[0];
  if (!firstDependency) return null;

  const dependencyState = state.task_states[firstDependency.taskId];

  if (firstDependency.strength === "STRONG" && dependencyState !== "COMPLETE") {
    return {
      kind: "STRONG",
      message: `This task depends on ${firstDependency.taskId}. You can fix it first or continue anyway.`,
    };
  }

  if (firstDependency.strength === "DEDUP") {
    if (dependencyState === "COMPLETE") {
      return { kind: "DEDUP", message: `${firstDependency.taskId} is already complete. Setup steps are skipped.` };
    }
    if (dependencyState === "SKIPPED" || dependencyState === "BLOCKED") {
      return { kind: "DEDUP", message: `${firstDependency.taskId} is ${dependencyState}. Review checklist before continuing.` };
    }
  }

  if (firstDependency.strength === "WEAK" && state.progress_percent >= 80 && dependencyState !== "COMPLETE") {
    return {
      kind: "WEAK",
      message: `Recommended: complete ${firstDependency.taskId} first, then return.`,
    };
  }

  return null;
}
