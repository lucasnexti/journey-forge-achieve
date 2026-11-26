import { z } from "zod";
export const surveyMetadataSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(200),
  presentation: z.string().max(2000),
  thank_you: z.string().trim().min(1, "Informe a mensagem de agradecimento").max(1000),
  anonymous: z.boolean(),
  training_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type AnswerValue = number | string | string[] | undefined;
export function packSurveyAnswers(values: Record<string, AnswerValue>, comments: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const id of new Set([...Object.keys(values), ...Object.keys(comments)])) {
    const value = values[id]; const comment = comments[id]?.trim();
    if (comment) result[id] = { value: value ?? null, comment };
    else if (value !== undefined) result[id] = typeof value === "string" ? value.trim() : value;
  }
  return result;
}
export function answerPercent(count: number, respondents: number) { return respondents > 0 ? count / respondents * 100 : null; }
export interface SurveyResults {
  title: string; anonymous: boolean; identified: boolean; invited: number; respondents: number;
  questions: { id: string; prompt: string; type: string; indicator: string | null; n: number; avg: number | null; min: number | null; max: number | null;
    distribution: { label: string; count: number }[] | null;
    comments: { text: string | null; additional: string | null; name: string | null; email: string | null }[] }[];
}