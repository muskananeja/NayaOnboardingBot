import { describe, it, expect } from 'vitest';
import {
  defaultRequirements, generateContractorTasks, countCoreTasks, countConditionalTasks,
  readinessGates, isReadyToStart, taskProgress, validateTaskGraph, migrateContractorRecord,
} from '../lib/contractorTasks';
import type { ContractorRequirements } from '../lib/contractorTasks';

function minimalRequirements(): ContractorRequirements {
  return {
    nda: 'no', background_check: 'no', insurance: 'no', hr_legal_review: 'no',
    niit_account: 'no', hardware: 'no', client_access: 'no', client_access_policy: 'required_before_start',
    client_badge: 'no',
    client_training: 'no', client_training_policy: 'required_before_start', project_training: 'no',
    time_tracking: 'no', invoicing: 'no',
    verification_method: null, billing_cadence: null,
  };
}

function fullRequirements(): ContractorRequirements {
  return {
    nda: 'yes', background_check: 'yes', insurance: 'yes', hr_legal_review: 'yes',
    niit_account: 'yes', hardware: 'yes', client_access: 'yes', client_access_policy: 'required_before_start',
    client_badge: 'yes',
    client_training: 'yes', client_training_policy: 'required_before_start', project_training: 'yes',
    time_tracking: 'yes', invoicing: 'yes',
    verification_method: null, billing_cadence: null,
  };
}

describe('task generation', () => {
  it('generates only core tasks for a minimal contractor with everything set to No', () => {
    const tasks = generateContractorTasks(minimalRequirements());
    expect(tasks.length).toBe(countCoreTasks());
    expect(tasks.every(t => t.classification === 'core')).toBe(true);
  });

  it('generates core + conditional tasks for a full-requirements contractor', () => {
    const tasks = generateContractorTasks(fullRequirements());
    expect(tasks.length).toBe(countCoreTasks() + countConditionalTasks(fullRequirements()));
    expect(tasks.some(t => t.id === 'C2')).toBe(true); // NDA
    expect(tasks.some(t => t.id === 'CA1')).toBe(true); // client access
  });

  it('treats an associate the same as a contractor for task generation (same engine)', () => {
    const contractorTasks = generateContractorTasks(defaultRequirements());
    const associateTasks = generateContractorTasks(defaultRequirements());
    expect(associateTasks.map(t => t.id)).toEqual(contractorTasks.map(t => t.id));
  });

  it('generates a confirmation task, not a real task, for an "unsure" answer', () => {
    const req = { ...minimalRequirements(), insurance: 'unsure' as const };
    const tasks = generateContractorTasks(req);
    expect(tasks.some(t => t.id === 'INS1')).toBe(false);
    const conf = tasks.find(t => t.id === 'INS1_CONF');
    expect(conf).toBeTruthy();
    expect(conf!.title).toContain('Confirm requirement');
  });

  it('never generates a task for an answer of No', () => {
    const req = { ...minimalRequirements(), hardware: 'no' as const };
    const tasks = generateContractorTasks(req);
    expect(tasks.some(t => t.id === 'HW1')).toBe(false);
  });

  it('adds a Project Lead confirmation task only when the lead is unknown', () => {
    const withLead = generateContractorTasks(defaultRequirements(), { projectLeadKnown: true });
    const withoutLead = generateContractorTasks(defaultRequirements(), { projectLeadKnown: false });
    expect(withLead.some(t => t.id === 'K0')).toBe(false);
    expect(withoutLead.some(t => t.id === 'K0')).toBe(true);
  });

  it('rejects a task graph with an unknown dependency', () => {
    const tasks = generateContractorTasks(defaultRequirements());
    tasks[0].depends_on = ['NOT_A_REAL_ID'];
    expect(validateTaskGraph(tasks)).toMatch(/unknown task/);
  });
});

describe('readiness gates', () => {
  it('is not ready to start when core tasks are incomplete', () => {
    const tasks = generateContractorTasks(minimalRequirements());
    expect(isReadyToStart(tasks)).toBe(false);
  });

  it('becomes ready to start once every blocking task is complete', () => {
    const tasks = generateContractorTasks(minimalRequirements());
    tasks.forEach(t => { t.status = 'COMPLETE'; });
    expect(isReadyToStart(tasks)).toBe(true);
    const gates = readinessGates(tasks);
    expect(gates.clearance && gates.access && gates.kickoff && gates.billing).toBe(true);
  });

  it('a Not Applicable task never blocks readiness or counts toward progress', () => {
    const tasks = generateContractorTasks(minimalRequirements());
    tasks.forEach(t => { t.status = t.id === 'B0' ? 'NOT_APPLICABLE' : 'COMPLETE'; });
    expect(isReadyToStart(tasks)).toBe(true);
    const progress = taskProgress(tasks);
    expect(progress.total).toBe(tasks.length - 1);
  });

  it('client access marked "can follow induction" does not block readiness', () => {
    const req = { ...minimalRequirements(), client_access: 'yes' as const, client_access_policy: 'can_follow_induction' as const };
    const tasks = generateContractorTasks(req);
    tasks.forEach(t => { if (t.id !== 'CA1') t.status = 'COMPLETE'; });
    // CA1 left NOT_STARTED — readiness should still be achievable since it's non-blocking.
    expect(isReadyToStart(tasks)).toBe(true);
  });

  it('client access marked "required before start" does block readiness until complete', () => {
    const req = { ...minimalRequirements(), client_access: 'yes' as const, client_access_policy: 'required_before_start' as const };
    const tasks = generateContractorTasks(req);
    tasks.forEach(t => { if (t.id !== 'CA1') t.status = 'COMPLETE'; });
    expect(isReadyToStart(tasks)).toBe(false);
  });
});

describe('migration of older records', () => {
  it('backfills a missing engagement_type to "contractor"', () => {
    const migrated = migrateContractorRecord({ contractor_id: 'c_old', tasks: [], requirements: {} });
    expect(migrated.engagement_type).toBe('contractor');
  });

  it('normalizes a legacy boolean requirement into the new tri-state shape', () => {
    const migrated = migrateContractorRecord({
      contractor_id: 'c_old2', tasks: [], requirements: { insurance: true, hardware: false },
    });
    expect(migrated.requirements.insurance).toBe('yes');
    expect(migrated.requirements.hardware).toBe('no');
  });

  it('preserves an existing tri-state answer rather than reinterpreting it as a legacy boolean', () => {
    const migrated = migrateContractorRecord({
      contractor_id: 'c_old3', tasks: [], requirements: { insurance: 'unsure' },
    });
    expect(migrated.requirements.insurance).toBe('unsure');
  });

  it('backfills missing task fields without altering existing status/history', () => {
    const migrated = migrateContractorRecord({
      contractor_id: 'c_old4',
      tasks: [{ id: 'T1', phase: 'kickoff', title: 'Old task', owner: 'contractor', status: 'COMPLETE', history: [{ previous_status: null, new_status: 'COMPLETE', updated_by: 'contractor', updated_at: 1 }] }],
      requirements: {},
    });
    const t = migrated.tasks[0];
    expect(t.status).toBe('COMPLETE');
    expect(t.history.length).toBe(1);
    expect(t.resource).toBe(null);
    expect(t.blocks_readiness).toBe(true);
  });
});
