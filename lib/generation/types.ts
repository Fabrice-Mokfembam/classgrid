export type SolverDay = { id: string; sortOrder: number };
export type SolverPeriod = { id: string; sortOrder: number; dayBlock: "morning" | "afternoon" | null };

export type SolverAssignment = {
  id: string;
  teacherId: string;
  subjectId: string;
  classSectionId: string;
  periodsPerWeek: number;
  pattern: "singles" | "double" | "mixed";
  doublePeriodCount: number;
  maxPerDay: number;
  preferMorning: boolean;
};

export type SolverInput = {
  days: SolverDay[];
  periods: SolverPeriod[];
  assignments: SolverAssignment[];
  teacherMaxPeriodsPerDay: Map<string, number | null>;
  teacherMaxConsecutive: Map<string, number>;
  unavailable: Set<string>; // `${teacherId}|${dayId}|${periodId}` entries explicitly marked unavailable
  preplaced?: PlacedLesson[]; // already-locked lessons the solver must work around (regenerate-unlocked)
  nodeBudget?: number;
  timeBudgetMs?: number;
};

export type PlacedLesson = {
  assignmentId: string;
  teacherId: string;
  subjectId: string;
  classSectionId: string;
  dayId: string;
  periodId: string;
};

export type UnscheduledLesson = {
  assignmentId: string;
  teacherId: string;
  subjectId: string;
  classSectionId: string;
  missingPeriods: number;
};

export type SoftWarning = {
  code: "prefer_morning_violated";
  assignmentId: string;
  count: number;
};

export type SolverResult = {
  placed: PlacedLesson[];
  unscheduled: UnscheduledLesson[];
  softWarnings: SoftWarning[];
  nodesExplored: number;
  timedOut: boolean;
};
