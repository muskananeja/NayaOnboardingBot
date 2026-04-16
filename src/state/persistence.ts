import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { UserState } from "./schema.js";

const STATE_DIR = join(homedir(), ".naya-bot");
const STATE_FILE = join(STATE_DIR, "state.json");

export function saveState(state: UserState): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(): UserState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as UserState;
  } catch {
    return null;
  }
}

export function clearState(): void {
  if (existsSync(STATE_FILE)) {
    writeFileSync(STATE_FILE, "", "utf-8");
  }
}

// Per-task step persistence (so resume knows which sub-step to return to)
const STEP_FILE = join(STATE_DIR, "steps.json");

export function saveStep(taskId: string, step: string): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  let steps: Record<string, string> = {};
  if (existsSync(STEP_FILE)) {
    try { steps = JSON.parse(readFileSync(STEP_FILE, "utf-8")); } catch { steps = {}; }
  }
  steps[taskId] = step;
  writeFileSync(STEP_FILE, JSON.stringify(steps), "utf-8");
}

export function loadStep(taskId: string): string {
  if (!existsSync(STEP_FILE)) return "MAIN";
  try {
    const steps: Record<string, string> = JSON.parse(readFileSync(STEP_FILE, "utf-8"));
    return steps[taskId] ?? "MAIN";
  } catch {
    return "MAIN";
  }
}

export function clearStep(taskId: string): void {
  if (!existsSync(STEP_FILE)) return;
  try {
    const steps: Record<string, string> = JSON.parse(readFileSync(STEP_FILE, "utf-8"));
    delete steps[taskId];
    writeFileSync(STEP_FILE, JSON.stringify(steps), "utf-8");
  } catch { /* ignore */ }
}
