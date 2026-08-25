import { describe, expect, it } from "vitest";
import { solve } from "./solver";
import type { SolverAssignment, SolverDay, SolverInput, SolverPeriod } from "./types";

function makeDays(n: number): SolverDay[] {
  return Array.from({ length: n }, (_, i) => ({ id: `d${i}`, sortOrder: i }));
}
function makePeriods(n: number): SolverPeriod[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, sortOrder: i, dayBlock: i < n / 2 ? "morning" : "afternoon" as const }));
}
function makeAssignment(a: Partial<SolverAssignment> & Pick<SolverAssignment, "id" | "teacherId" | "subjectId" | "classSectionId" | "periodsPerWeek">): SolverAssignment {
  return { pattern: "singles", doublePeriodCount: 0, maxPerDay: 1, preferMorning: false, ...a };
}
function baseInput(overrides: Partial<SolverInput>): SolverInput {
  return {
    days: makeDays(5),
    periods: makePeriods(6),
    assignments: [],
    teacherMaxPeriodsPerDay: new Map(),
    teacherMaxConsecutive: new Map(),
    unavailable: new Set(),
    ...overrides,
  };
}
function longestRun(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { cur++; best = Math.max(best, cur); }
    else if (sorted[i] !== sorted[i - 1]) cur = 1;
  }
  return best;
}

describe("solve — basic placement", () => {
  it("schedules a simple assignment across distinct days when maxPerDay is 1", () => {
    const assignments = [makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 3, maxPerDay: 1 })];
    const result = solve(baseInput({ assignments }));
    expect(result.placed).toHaveLength(3);
    expect(result.unscheduled).toHaveLength(0);
    expect(new Set(result.placed.map(p => p.dayId)).size).toBe(3);
  });

  it("does not double-book a teacher across two different classes in the same slot", () => {
    const days = makeDays(1), periods = makePeriods(1);
    const assignments = [
      makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 1 }),
      makeAssignment({ id: "a2", teacherId: "t1", subjectId: "s2", classSectionId: "c2", periodsPerWeek: 1 }),
    ];
    const result = solve(baseInput({ days, periods, assignments }));
    expect(result.placed).toHaveLength(1);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].missingPeriods).toBe(1);
  });

  it("respects explicit teacher unavailability", () => {
    const days = makeDays(1), periods = makePeriods(1);
    const assignments = [makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 1 })];
    const unavailable = new Set([`t1|${days[0].id}|${periods[0].id}`]);
    const result = solve(baseInput({ days, periods, assignments, unavailable }));
    expect(result.placed).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(1);
  });

  it("enforces an assignment's own maxPerDay", () => {
    const days = makeDays(1), periods = makePeriods(3);
    const assignments = [makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 3, maxPerDay: 1 })];
    const result = solve(baseInput({ days, periods, assignments }));
    expect(result.placed).toHaveLength(1);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].missingPeriods).toBe(2);
  });

  it("enforces a teacher's max periods per day across multiple assignments", () => {
    const days = makeDays(1), periods = makePeriods(3);
    const assignments = [
      makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 2, maxPerDay: 2 }),
      makeAssignment({ id: "a2", teacherId: "t1", subjectId: "s2", classSectionId: "c2", periodsPerWeek: 2, maxPerDay: 2 }),
    ];
    const teacherMaxPeriodsPerDay = new Map([["t1", 2]]);
    const result = solve(baseInput({ days, periods, assignments, teacherMaxPeriodsPerDay }));
    expect(result.placed).toHaveLength(2);
    expect(result.unscheduled.reduce((sum, u) => sum + u.missingPeriods, 0)).toBe(2);
  });

  it("never exceeds a teacher's max consecutive periods on any day", () => {
    const days = makeDays(1), periods = makePeriods(5);
    const assignments = [makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 5, maxPerDay: 5 })];
    const teacherMaxConsecutive = new Map([["t1", 3]]);
    const result = solve(baseInput({ days, periods, assignments, teacherMaxConsecutive }));
    const sortOrders = result.placed.map(p => periods.find(x => x.id === p.periodId)!.sortOrder).sort((a, b) => a - b);
    expect(longestRun(sortOrders)).toBeLessThanOrEqual(3);
  });

  it("places a double-period lesson across two consecutive periods", () => {
    const days = makeDays(1), periods = makePeriods(3);
    const assignments = [makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 2, maxPerDay: 2, pattern: "double", doublePeriodCount: 1 })];
    const result = solve(baseInput({ days, periods, assignments }));
    expect(result.placed).toHaveLength(2);
    const orders = result.placed.map(p => periods.find(x => x.id === p.periodId)!.sortOrder).sort((a, b) => a - b);
    expect(orders[1] - orders[0]).toBe(1);
  });

  it("keeps preplaced (locked) entries untouched and schedules the rest around them", () => {
    const days = makeDays(1), periods = makePeriods(2);
    const assignments = [makeAssignment({ id: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", periodsPerWeek: 2, maxPerDay: 2 })];
    const preplaced = [{ assignmentId: "a1", teacherId: "t1", subjectId: "s1", classSectionId: "c1", dayId: days[0].id, periodId: periods[0].id }];
    const result = solve(baseInput({ days, periods, assignments, preplaced }));
    expect(result.placed).toHaveLength(1);
    expect(result.placed[0].periodId).toBe(periods[1].id);
    expect(result.unscheduled).toHaveLength(0);
  });
});

describe("solve — parallel subject groups", () => {
  it("does not let two non-parallel subjects share a class's slot", () => {
    const days = makeDays(1), periods = makePeriods(1);
    const assignments = [
      makeAssignment({ id: "a1", teacherId: "t1", subjectId: "com", classSectionId: "c1", periodsPerWeek: 1 }),
      makeAssignment({ id: "a2", teacherId: "t2", subjectId: "csc", classSectionId: "c1", periodsPerWeek: 1 }),
    ];
    const result = solve(baseInput({ days, periods, assignments }));
    expect(result.placed).toHaveLength(1);
    expect(result.unscheduled).toHaveLength(1);
  });

  it("lets two parallel-compatible subjects share one class's slot (the COM/CSC case)", () => {
    const days = makeDays(1), periods = makePeriods(1);
    const assignments = [
      makeAssignment({ id: "a1", teacherId: "t1", subjectId: "com", classSectionId: "c1", periodsPerWeek: 1 }),
      makeAssignment({ id: "a2", teacherId: "t2", subjectId: "csc", classSectionId: "c1", periodsPerWeek: 1 }),
    ];
    const parallelSubjectPairs = new Set(["c1|com|csc"]);
    const result = solve(baseInput({ days, periods, assignments, parallelSubjectPairs }));
    expect(result.placed).toHaveLength(2);
    expect(result.unscheduled).toHaveLength(0);
    expect(result.placed[0].dayId).toBe(result.placed[1].dayId);
    expect(result.placed[0].periodId).toBe(result.placed[1].periodId);
  });

  it("actively reuses a parallel-compatible occupied slot over an equally-loaded empty one", () => {
    // Two days, one slot each. Without the active co-placement preference, plain load
    // balancing would spread the two lessons across both days (lower load wins ties).
    // With it, the second unit should prefer reusing day 0's slot alongside the first.
    const days = makeDays(2), periods = makePeriods(1);
    const assignments = [
      makeAssignment({ id: "a1", teacherId: "t1", subjectId: "com", classSectionId: "c1", periodsPerWeek: 1 }),
      makeAssignment({ id: "a2", teacherId: "t2", subjectId: "csc", classSectionId: "c1", periodsPerWeek: 1 }),
    ];
    const parallelSubjectPairs = new Set(["c1|com|csc"]);
    const result = solve(baseInput({ days, periods, assignments, parallelSubjectPairs }));
    expect(result.placed).toHaveLength(2);
    expect(result.placed[0].dayId).toBe(result.placed[1].dayId);
    expect(result.placed[0].dayId).toBe(days[0].id);
  });

  it("still refuses to double-book the same subject twice in one class slot", () => {
    // Same subject can't be its own parallel partner even if it happens to be a group member.
    const days = makeDays(1), periods = makePeriods(1);
    const assignments = [
      makeAssignment({ id: "a1", teacherId: "t1", subjectId: "com", classSectionId: "c1", periodsPerWeek: 1 }),
      makeAssignment({ id: "a2", teacherId: "t2", subjectId: "com", classSectionId: "c1", periodsPerWeek: 1 }),
    ];
    const parallelSubjectPairs = new Set(["c1|com|com"]);
    const result = solve(baseInput({ days, periods, assignments, parallelSubjectPairs }));
    expect(result.placed).toHaveLength(1);
    expect(result.unscheduled).toHaveLength(1);
  });
});

describe("solve — coverage-first repair", () => {
  it("gives every assignment one period before adding extra periods", () => {
    const days = makeDays(1), periods = makePeriods(3);
    const assignments = [
      makeAssignment({ id: "maths", teacherId: "t1", subjectId: "maths", classSectionId: "c1", periodsPerWeek: 3, maxPerDay: 3 }),
      makeAssignment({ id: "biology", teacherId: "t2", subjectId: "biology", classSectionId: "c1", periodsPerWeek: 3, maxPerDay: 3 }),
    ];

    const result = solve(baseInput({ days, periods, assignments, coverageFirst: true }));

    expect(new Set(result.placed.map(lesson => lesson.assignmentId))).toEqual(new Set(["maths", "biology"]));
    expect(result.placed).toHaveLength(3);
  });

  it("keeps other classes as fixed blockers while repairing one class", () => {
    const days = makeDays(1), periods = makePeriods(2);
    const assignments = [
      makeAssignment({ id: "fixed", teacherId: "shared", subjectId: "history", classSectionId: "other", periodsPerWeek: 1 }),
      makeAssignment({ id: "maths", teacherId: "shared", subjectId: "maths", classSectionId: "target", periodsPerWeek: 1 }),
    ];
    const preplaced = [{ assignmentId: "fixed", teacherId: "shared", subjectId: "history", classSectionId: "other", dayId: days[0].id, periodId: periods[0].id }];

    const result = solve(baseInput({ days, periods, assignments, preplaced, coverageFirst: true }));

    expect(result.placed).toHaveLength(1);
    expect(result.placed[0].periodId).toBe(periods[1].id);
  });

  it("does not prioritize another period for a subject already covered by a locked lesson", () => {
    const days = makeDays(1), periods = makePeriods(2);
    const assignments = [
      makeAssignment({ id: "maths", teacherId: "t1", subjectId: "maths", classSectionId: "target", periodsPerWeek: 3, maxPerDay: 3 }),
      makeAssignment({ id: "biology", teacherId: "t2", subjectId: "biology", classSectionId: "target", periodsPerWeek: 1 }),
    ];
    const preplaced = [{ assignmentId: "maths", teacherId: "t1", subjectId: "maths", classSectionId: "target", dayId: days[0].id, periodId: periods[0].id }];

    const result = solve(baseInput({ days, periods, assignments, preplaced, coverageFirst: true }));

    expect(result.placed).toHaveLength(1);
    expect(result.placed[0].assignmentId).toBe("biology");
    expect(result.placed[0].periodId).toBe(periods[1].id);
  });

  it("blocks the substitute teacher used by a locked lesson", () => {
    const days = makeDays(1), periods = makePeriods(2);
    const assignments = [
      makeAssignment({ id: "maths", teacherId: "usual", subjectId: "maths", classSectionId: "target", periodsPerWeek: 1 }),
      makeAssignment({ id: "history", teacherId: "substitute", subjectId: "history", classSectionId: "other", periodsPerWeek: 1 }),
    ];
    const preplaced = [{ assignmentId: "maths", teacherId: "substitute", subjectId: "maths", classSectionId: "target", dayId: days[0].id, periodId: periods[0].id }];

    const result = solve(baseInput({ days, periods, assignments, preplaced }));

    expect(result.placed).toHaveLength(1);
    expect(result.placed[0].assignmentId).toBe("history");
    expect(result.placed[0].periodId).toBe(periods[1].id);
  });
});
