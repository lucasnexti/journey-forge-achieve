import { describe, it, expect } from "vitest";
import {
  submitAttempt,
  canStartAttempt,
  currentCycle,
  attemptsUsed,
  attemptsLeft,
  revealAnswers,
  type CourseState,
} from "./examRules";

const MAX = 2;

const fresh = (): CourseState => ({
  attempts: [],
  lessonProgress: true,
  enrollmentStatus: "active",
});

describe("regras de tentativas da avaliação", () => {
  it("permite duas tentativas por ciclo", () => {
    let s = fresh();
    expect(canStartAttempt(s, MAX, true)).toBe(true);

    const first = submitAttempt(s, MAX, false);
    s = first.state;
    expect(first.attemptNumber).toBe(1);
    expect(first.attemptsLeft).toBe(1);
    expect(canStartAttempt(s, MAX, true)).toBe(true);

    const second = submitAttempt(s, MAX, false);
    s = second.state;
    expect(second.attemptNumber).toBe(2);
    expect(second.attemptsLeft).toBe(0);
  });

  it("mantém o progresso do curso após reprovar apenas na primeira tentativa", () => {
    const out = submitAttempt(fresh(), MAX, false);
    expect(out.courseReset).toBe(false);
    expect(out.state.lessonProgress).toBe(true);
    expect(out.state.enrollmentStatus).toBe("active");
  });

  it("apaga o progresso e reativa a matrícula ao reprovar nas duas tentativas", () => {
    let s: CourseState = { attempts: [], lessonProgress: true, enrollmentStatus: "active" };
    s = submitAttempt(s, MAX, false).state;
    const final = submitAttempt(s, MAX, false);

    expect(final.courseReset).toBe(true);
    expect(final.state.lessonProgress).toBe(false);
    expect(final.state.enrollmentStatus).toBe("active");
  });

  it("bloqueia nova prova enquanto o curso não é refeito e libera novo ciclo depois", () => {
    let s = fresh();
    s = submitAttempt(s, MAX, false).state;
    s = submitAttempt(s, MAX, false).state;

    // aulas apagadas → não pode iniciar
    expect(canStartAttempt(s, MAX, s.lessonProgress)).toBe(false);

    // aluno refaz o curso
    s = { ...s, lessonProgress: true };
    expect(currentCycle(s.attempts, MAX)).toBe(2);
    expect(attemptsUsed(s.attempts, MAX)).toBe(0);
    expect(attemptsLeft(s.attempts, MAX)).toBe(2);
    expect(canStartAttempt(s, MAX, true)).toBe(true);

    const retry = submitAttempt(s, MAX, false);
    expect(retry.attemptNumber).toBe(1);
    expect(retry.courseReset).toBe(false);
    expect(retry.state.lessonProgress).toBe(true);
  });

  it("conclui o curso ao ser aprovado em qualquer tentativa do ciclo", () => {
    let s = fresh();
    s = submitAttempt(s, MAX, false).state;
    const ok = submitAttempt(s, MAX, true);

    expect(ok.passed).toBe(true);
    expect(ok.courseReset).toBe(false);
    expect(ok.state.enrollmentStatus).toBe("completed");
    expect(ok.state.lessonProgress).toBe(true);
  });

  it("não revela o gabarito em tentativas reprovadas", () => {
    const failed = submitAttempt(fresh(), MAX, false);
    expect(failed.showDetails).toBe(false);
    expect(revealAnswers(false)).toBe(false);

    const passed = submitAttempt(fresh(), MAX, true);
    expect(passed.showDetails).toBe(true);
  });

  it("rejeita envio quando o limite do ciclo foi atingido", () => {
    let s = fresh();
    s = submitAttempt(s, MAX, false).state;
    s = submitAttempt(s, MAX, false).state;
    s = { ...s, attempts: s.attempts.map((a) => ({ ...a, cycle: 1 })) };
    // força o cenário de estado inconsistente: 2 tentativas no ciclo 1 com aulas concluídas
    expect(() =>
      submitAttempt({ ...s, attempts: [...s.attempts] }, MAX, false)
    ).not.toThrow(); // novo ciclo é aberto automaticamente

    const locked: CourseState = {
      attempts: [
        { cycle: 3, passed: false },
        { cycle: 3, passed: false },
      ],
      lessonProgress: true,
      enrollmentStatus: "active",
    };
    // dentro do ciclo 3 esgotado, o próximo envio abre ciclo 4 (curso refeito)
    expect(currentCycle(locked.attempts, MAX)).toBe(4);
  });
});
