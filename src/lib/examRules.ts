// Regras de tentativas da avaliação — espelham a RPC public.submit_exam_attempt.
// Mantidas em TS puro para permitir testes automatizados e uso na UI.

export interface AttemptRecord {
  cycle: number;
  passed: boolean;
}

export interface CourseState {
  /** Tentativas já registradas (todos os ciclos). */
  attempts: AttemptRecord[];
  /** Progresso das aulas persistido (lesson_progress). */
  lessonProgress: boolean;
  enrollmentStatus: "active" | "completed" | "cancelled";
}

/** Ciclo atual: avança quando o ciclo anterior esgotou as tentativas. */
export function currentCycle(attempts: AttemptRecord[], maxAttempts: number): number {
  if (attempts.length === 0) return 1;
  const cycle = Math.max(...attempts.map((a) => a.cycle));
  const used = attempts.filter((a) => a.cycle === cycle).length;
  return maxAttempts > 0 && used >= maxAttempts ? cycle + 1 : cycle;
}

/** Tentativas já usadas dentro do ciclo corrente. */
export function attemptsUsed(attempts: AttemptRecord[], maxAttempts: number): number {
  const cycle = currentCycle(attempts, maxAttempts);
  return attempts.filter((a) => a.cycle === cycle).length;
}

export function attemptsLeft(attempts: AttemptRecord[], maxAttempts: number): number | null {
  if (maxAttempts <= 0) return null;
  return Math.max(maxAttempts - attemptsUsed(attempts, maxAttempts), 0);
}

/** O aluno só inicia a prova com aulas 100% concluídas e tentativas disponíveis no ciclo. */
export function canStartAttempt(
  state: CourseState,
  maxAttempts: number,
  lessonsCompleted: boolean
): boolean {
  if (!lessonsCompleted) return false;
  return maxAttempts <= 0 || attemptsUsed(state.attempts, maxAttempts) < maxAttempts;
}

/** O gabarito só é revelado quando o aluno é aprovado. */
export function revealAnswers(passed: boolean): boolean {
  return passed;
}

export interface SubmitOutcome {
  state: CourseState;
  passed: boolean;
  attemptNumber: number;
  attemptsLeft: number | null;
  courseReset: boolean;
  showDetails: boolean;
}

/** Simula o envio de uma tentativa aplicando as mesmas regras da RPC. */
export function submitAttempt(
  state: CourseState,
  maxAttempts: number,
  passed: boolean
): SubmitOutcome {
  const cycle = currentCycle(state.attempts, maxAttempts);
  const used = state.attempts.filter((a) => a.cycle === cycle).length;
  if (maxAttempts > 0 && used >= maxAttempts) {
    throw new Error("attempt_limit_reached");
  }

  const attempts = [...state.attempts, { cycle, passed }];
  const isFinalFailure = !passed && maxAttempts > 0 && used + 1 >= maxAttempts;

  const next: CourseState = {
    attempts,
    lessonProgress: isFinalFailure ? false : state.lessonProgress,
    enrollmentStatus: passed ? "completed" : isFinalFailure ? "active" : state.enrollmentStatus,
  };

  return {
    state: next,
    passed,
    attemptNumber: used + 1,
    attemptsLeft: attemptsLeft(attempts, maxAttempts),
    courseReset: isFinalFailure,
    showDetails: revealAnswers(passed),
  };
}
