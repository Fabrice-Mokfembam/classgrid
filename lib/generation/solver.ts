import type {
  PlacedLesson, SoftWarning, SolverAssignment, SolverDay, SolverInput,
  SolverPeriod, SolverResult, UnscheduledLesson,
} from "./types";

type Unit = { id: string; assignment: SolverAssignment; isDouble: boolean };
type Candidate = { day: SolverDay; periods: SolverPeriod[] };

type SearchState = {
  teacherBusy: Set<string>; // `${teacherId}|${dayId}|${periodId}`
  classBusy: Set<string>; // `${classSectionId}|${dayId}|${periodId}`
  assignmentDayCount: Map<string, number>; // `${assignmentId}|${dayId}`
  teacherDayCount: Map<string, number>; // `${teacherId}|${dayId}`
  teacherDaySortOrders: Map<string, number[]>; // `${teacherId}|${dayId}`
  classDayCount: Map<string, number>; // `${classSectionId}|${dayId}`
};

class BudgetExceeded extends Error {}

const sortOrderAsc = (a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder;

function buildUnits(assignments: SolverAssignment[], preplacedByAssignment: Map<string, number>): Unit[] {
  const units: Unit[] = [];
  for (const a of assignments) {
    const remaining = Math.max(0, a.periodsPerWeek - (preplacedByAssignment.get(a.id) ?? 0));
    let numDoubles = a.pattern === "singles" ? 0 : Math.min(a.doublePeriodCount, Math.floor(remaining / 2));
    let numSingles = remaining - numDoubles * 2;
    if (numSingles < 0) {
      numDoubles = Math.floor(remaining / 2);
      numSingles = remaining - numDoubles * 2;
    }
    for (let i = 0; i < numDoubles; i++) units.push({ id: `${a.id}#d${i}`, assignment: a, isDouble: true });
    for (let i = 0; i < numSingles; i++) units.push({ id: `${a.id}#s${i}`, assignment: a, isDouble: false });
  }
  return units;
}

function computeDoublePairs(periods: SolverPeriod[]): [SolverPeriod, SolverPeriod][] {
  const pairs: [SolverPeriod, SolverPeriod][] = [];
  for (let i = 0; i < periods.length - 1; i++) {
    if (periods[i + 1].sortOrder - periods[i].sortOrder === 1) pairs.push([periods[i], periods[i + 1]]);
  }
  return pairs;
}

function longestConsecutiveRun(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { cur++; best = Math.max(best, cur); }
    else if (sorted[i] !== sorted[i - 1]) cur = 1;
  }
  return best;
}

function canPlace(assignment: SolverAssignment, day: SolverDay, periods: SolverPeriod[], state: SearchState, input: SolverInput): boolean {
  for (const period of periods) {
    const teacherKey = `${assignment.teacherId}|${day.id}|${period.id}`;
    if (state.teacherBusy.has(teacherKey)) return false;
    if (input.unavailable.has(teacherKey)) return false;
    const classKey = `${assignment.classSectionId}|${day.id}|${period.id}`;
    if (state.classBusy.has(classKey)) return false;
  }

  const assignDayKey = `${assignment.id}|${day.id}`;
  if ((state.assignmentDayCount.get(assignDayKey) ?? 0) + periods.length > assignment.maxPerDay) return false;

  const teacherDayKey = `${assignment.teacherId}|${day.id}`;
  const teacherMax = input.teacherMaxPeriodsPerDay.get(assignment.teacherId);
  if (teacherMax != null && (state.teacherDayCount.get(teacherDayKey) ?? 0) + periods.length > teacherMax) return false;

  const maxConsecutive = input.teacherMaxConsecutive.get(assignment.teacherId) ?? 4;
  const existing = state.teacherDaySortOrders.get(teacherDayKey) ?? [];
  const combined = [...existing, ...periods.map(p => p.sortOrder)].sort((a, b) => a - b);
  if (longestConsecutiveRun(combined) > maxConsecutive) return false;

  return true;
}

function place(assignment: SolverAssignment, day: SolverDay, periods: SolverPeriod[], state: SearchState) {
  for (const period of periods) {
    state.teacherBusy.add(`${assignment.teacherId}|${day.id}|${period.id}`);
    state.classBusy.add(`${assignment.classSectionId}|${day.id}|${period.id}`);
  }
  const assignDayKey = `${assignment.id}|${day.id}`;
  state.assignmentDayCount.set(assignDayKey, (state.assignmentDayCount.get(assignDayKey) ?? 0) + periods.length);
  const teacherDayKey = `${assignment.teacherId}|${day.id}`;
  state.teacherDayCount.set(teacherDayKey, (state.teacherDayCount.get(teacherDayKey) ?? 0) + periods.length);
  state.teacherDaySortOrders.set(teacherDayKey, [...(state.teacherDaySortOrders.get(teacherDayKey) ?? []), ...periods.map(p => p.sortOrder)]);
  const classDayKey = `${assignment.classSectionId}|${day.id}`;
  state.classDayCount.set(classDayKey, (state.classDayCount.get(classDayKey) ?? 0) + periods.length);
}

function unplace(assignment: SolverAssignment, day: SolverDay, periods: SolverPeriod[], state: SearchState) {
  for (const period of periods) {
    state.teacherBusy.delete(`${assignment.teacherId}|${day.id}|${period.id}`);
    state.classBusy.delete(`${assignment.classSectionId}|${day.id}|${period.id}`);
  }
  const assignDayKey = `${assignment.id}|${day.id}`;
  state.assignmentDayCount.set(assignDayKey, (state.assignmentDayCount.get(assignDayKey) ?? 0) - periods.length);
  const teacherDayKey = `${assignment.teacherId}|${day.id}`;
  state.teacherDayCount.set(teacherDayKey, (state.teacherDayCount.get(teacherDayKey) ?? 0) - periods.length);
  const existing = state.teacherDaySortOrders.get(teacherDayKey) ?? [];
  const toRemove = new Set(periods.map(p => p.sortOrder));
  state.teacherDaySortOrders.set(teacherDayKey, existing.filter(so => {
    if (toRemove.has(so)) { toRemove.delete(so); return false; }
    return true;
  }));
  const classDayKey = `${assignment.classSectionId}|${day.id}`;
  state.classDayCount.set(classDayKey, (state.classDayCount.get(classDayKey) ?? 0) - periods.length);
}

function getCandidates(unit: Unit, days: SolverDay[], doublePairs: [SolverPeriod, SolverPeriod][], lessonPeriods: SolverPeriod[], state: SearchState, input: SolverInput): Candidate[] {
  const candidates: Candidate[] = [];
  if (!unit.isDouble) {
    for (const day of days) {
      for (const period of lessonPeriods) {
        if (canPlace(unit.assignment, day, [period], state, input)) candidates.push({ day, periods: [period] });
      }
    }
  } else {
    for (const day of days) {
      for (const [p1, p2] of doublePairs) {
        if (canPlace(unit.assignment, day, [p1, p2], state, input)) candidates.push({ day, periods: [p1, p2] });
      }
    }
  }

  const a = unit.assignment;
  return candidates.sort((x, y) => {
    if (a.preferMorning) {
      const xm = x.periods[0].dayBlock === "morning" ? 0 : 1;
      const ym = y.periods[0].dayBlock === "morning" ? 0 : 1;
      if (xm !== ym) return xm - ym;
    }
    const loadX = (state.classDayCount.get(`${a.classSectionId}|${x.day.id}`) ?? 0) + (state.teacherDayCount.get(`${a.teacherId}|${x.day.id}`) ?? 0);
    const loadY = (state.classDayCount.get(`${a.classSectionId}|${y.day.id}`) ?? 0) + (state.teacherDayCount.get(`${a.teacherId}|${y.day.id}`) ?? 0);
    if (loadX !== loadY) return loadX - loadY;
    if (x.day.sortOrder !== y.day.sortOrder) return x.day.sortOrder - y.day.sortOrder;
    return x.periods[0].sortOrder - y.periods[0].sortOrder;
  });
}

type Budget = { nodes: number; maxNodes: number; start: number; maxMs: number };

function backtrack(
  units: Unit[], idx: number, days: SolverDay[], doublePairs: [SolverPeriod, SolverPeriod][], lessonPeriods: SolverPeriod[],
  state: SearchState, input: SolverInput, placements: Map<string, Candidate>, budget: Budget,
): boolean {
  if (idx === units.length) return true;
  budget.nodes++;
  if (budget.nodes > budget.maxNodes || Date.now() - budget.start > budget.maxMs) throw new BudgetExceeded();

  const unit = units[idx];
  const candidates = getCandidates(unit, days, doublePairs, lessonPeriods, state, input);
  for (const cand of candidates) {
    place(unit.assignment, cand.day, cand.periods, state);
    placements.set(unit.id, cand);
    if (backtrack(units, idx + 1, days, doublePairs, lessonPeriods, state, input, placements, budget)) return true;
    unplace(unit.assignment, cand.day, cand.periods, state);
    placements.delete(unit.id);
  }
  return false;
}

function createEmptyState(): SearchState {
  return { teacherBusy: new Set(), classBusy: new Set(), assignmentDayCount: new Map(), teacherDayCount: new Map(), teacherDaySortOrders: new Map(), classDayCount: new Map() };
}

export function solve(input: SolverInput): SolverResult {
  const days = input.days.slice().sort(sortOrderAsc);
  const lessonPeriods = input.periods.slice().sort(sortOrderAsc);
  const doublePairs = computeDoublePairs(lessonPeriods);
  const assignmentsById = new Map(input.assignments.map(a => [a.id, a]));
  const daysById = new Map(days.map(d => [d.id, d]));
  const periodsById = new Map(lessonPeriods.map(p => [p.id, p]));

  const state = createEmptyState();
  const preplacedByAssignment = new Map<string, number>();
  for (const p of input.preplaced ?? []) {
    const assignment = assignmentsById.get(p.assignmentId);
    const day = daysById.get(p.dayId);
    const period = periodsById.get(p.periodId);
    if (!assignment || !day || !period) continue;
    place(assignment, day, [period], state);
    preplacedByAssignment.set(p.assignmentId, (preplacedByAssignment.get(p.assignmentId) ?? 0) + 1);
  }

  const allUnits = buildUnits(input.assignments, preplacedByAssignment);
  const unitsById = new Map(allUnits.map(u => [u.id, u]));

  const domainSize = new Map(allUnits.map(u => [u.id, getCandidates(u, days, doublePairs, lessonPeriods, state, input).length]));
  const orderedUnits = allUnits.slice().sort((a, b) => (domainSize.get(a.id) ?? 0) - (domainSize.get(b.id) ?? 0));

  const placements = new Map<string, Candidate>();
  const budget: Budget = { nodes: 0, maxNodes: input.nodeBudget ?? 100_000, start: Date.now(), maxMs: input.timeBudgetMs ?? 8000 };

  let remaining = orderedUnits;
  let timedOut = false;
  while (remaining.length > 0) {
    try {
      const ok = backtrack(remaining, 0, days, doublePairs, lessonPeriods, state, input, placements, budget);
      if (ok) { remaining = []; break; }
      remaining = remaining.slice(1);
    } catch (e) {
      if (e instanceof BudgetExceeded) { timedOut = true; break; }
      throw e;
    }
  }

  const unscheduledByAssignment = new Map<string, { assignment: SolverAssignment; missing: number }>();
  for (const unit of allUnits) {
    if (!placements.has(unit.id)) {
      const rec = unscheduledByAssignment.get(unit.assignment.id) ?? { assignment: unit.assignment, missing: 0 };
      rec.missing += unit.isDouble ? 2 : 1;
      unscheduledByAssignment.set(unit.assignment.id, rec);
    }
  }
  const unscheduled: UnscheduledLesson[] = [...unscheduledByAssignment.values()].map(r => ({
    assignmentId: r.assignment.id, teacherId: r.assignment.teacherId, subjectId: r.assignment.subjectId,
    classSectionId: r.assignment.classSectionId, missingPeriods: r.missing,
  }));

  const placed: PlacedLesson[] = [];
  const softByAssignment = new Map<string, number>();
  for (const [unitId, cand] of placements) {
    const unit = unitsById.get(unitId)!;
    for (const period of cand.periods) {
      placed.push({ assignmentId: unit.assignment.id, teacherId: unit.assignment.teacherId, subjectId: unit.assignment.subjectId, classSectionId: unit.assignment.classSectionId, dayId: cand.day.id, periodId: period.id });
    }
    if (unit.assignment.preferMorning) {
      const violated = cand.periods.some(p => (periodsById.get(p.id)?.dayBlock ?? null) !== "morning");
      if (violated) softByAssignment.set(unit.assignment.id, (softByAssignment.get(unit.assignment.id) ?? 0) + 1);
    }
  }
  const softWarnings: SoftWarning[] = [...softByAssignment.entries()].map(([assignmentId, count]) => ({ code: "prefer_morning_violated", assignmentId, count }));

  return { placed, unscheduled, softWarnings, nodesExplored: budget.nodes, timedOut };
}
