import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../state/schema.js";
import { calculatePhaseProgress } from "../state/progress.js";
import { openTask, setTaskState } from "../state/transitions.js";
import { buildResumeSummary } from "../flows/resume.js";

test("complete state is immutable", () => {
  const initial = createInitialState("entry");
  const completed = setTaskState(initial, "P1", "COMPLETE");
  const regressed = setTaskState(completed, "P1", "IN_PROGRESS");
  assert.equal(regressed.task_states.P1, "COMPLETE");
});

test("phase progress uses weighted credits", () => {
  let state = createInitialState("entry");
  state = setTaskState(state, "P1", "COMPLETE");
  state = setTaskState(state, "P2", "COMPLETE");
  state = setTaskState(state, "P3", "IN_PROGRESS"); // action should be 0
  assert.equal(calculatePhaseProgress(state), 28.57);
});

test("resume summary suggests last active task", () => {
  let state = createInitialState("lateral");
  state = openTask(state, "P2");
  const summary = buildResumeSummary(state);
  assert.equal(summary.suggestedNextTask, "P2");
  assert.equal(summary.options.length, 3);
});
