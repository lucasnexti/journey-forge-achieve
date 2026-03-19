import { tracks } from './data';

export interface LessonProgress {
  completed: boolean;
  watchedSeconds: number;
}

export interface TrackProgress {
  lessons: Record<string, LessonProgress>;
  quizScore: number | null;
  quizPassed: boolean;
  completedAt: string | null;
}

export type AllProgress = Record<string, TrackProgress>;

const STORAGE_KEY = 'uc-progress';

export function getProgress(): AllProgress {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveProgress(progress: AllProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getTrackProgress(trackId: string): TrackProgress {
  const all = getProgress();
  return all[trackId] || { lessons: {}, quizScore: null, quizPassed: false, completedAt: null };
}

export function markLessonComplete(trackId: string, lessonId: string, watchedSeconds: number) {
  const all = getProgress();
  if (!all[trackId]) all[trackId] = { lessons: {}, quizScore: null, quizPassed: false, completedAt: null };
  all[trackId].lessons[lessonId] = { completed: true, watchedSeconds };
  saveProgress(all);
}

export function saveQuizResult(trackId: string, score: number, passed: boolean) {
  const all = getProgress();
  if (!all[trackId]) all[trackId] = { lessons: {}, quizScore: null, quizPassed: false, completedAt: null };
  all[trackId].quizScore = score;
  all[trackId].quizPassed = passed;
  if (passed) all[trackId].completedAt = new Date().toISOString();
  saveProgress(all);
}

export function isTrackUnlocked(trackId: string): boolean {
  const track = tracks.find(t => t.id === trackId);
  if (!track) return false;
  // First track is always unlocked
  const trackIndex = tracks.findIndex(t => t.id === trackId);
  if (trackIndex === 0) return true;
  // Previous track must be passed
  const prevTrack = tracks[trackIndex - 1];
  const prevProgress = getTrackProgress(prevTrack.id);
  return prevProgress.quizPassed;
}

export function getTrackCompletionPercent(trackId: string): number {
  const track = tracks.find(t => t.id === trackId);
  if (!track) return 0;
  const progress = getTrackProgress(trackId);
  const completedLessons = Object.values(progress.lessons).filter(l => l.completed).length;
  const lessonPercent = (completedLessons / track.totalLessons) * 80;
  const quizPercent = progress.quizPassed ? 20 : 0;
  return Math.round(lessonPercent + quizPercent);
}

export function getTotalWatchedSeconds(): number {
  const all = getProgress();
  let total = 0;
  for (const tp of Object.values(all)) {
    for (const lp of Object.values(tp.lessons)) {
      total += lp.watchedSeconds;
    }
  }
  return total;
}

export function getAverageQuizScore(): number {
  const all = getProgress();
  const scores = Object.values(all).map(tp => tp.quizScore).filter((s): s is number => s !== null);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}
