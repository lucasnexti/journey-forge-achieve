# Preserve exam approvals and enforce module completion

## Verified findings
- Relinking changes the exam’s module, but historical attempts retain the old module. Current module queries exclude those attempts even though their exam ID still counts toward the attempt limit. No passed attempts currently match this historical mismatch in the live data; the defect remains reproducible in the current logic.
- A course with only module exams is treated as having no final exam. The current completion function checks lessons but not module approvals, allowing completion and certificate creation before the last module exam is passed.

## Changes
1. Recognize approval by the exam’s stable ID and current course/module association, not solely the module copied into the historical attempt. Preserve original attempts, scores, dates and attempt counts; do not fabricate approvals or transfer credit from unrelated exams.
2. Apply the same association rule to module locks, best scores, next-step navigation, final-exam history and module reward evidence. Restrict reuse to attempts for the same exam and course; moving an exam to a different course must not grant credit automatically.
3. Require all applicable active module exams to be passed before completing the course or creating a certificate. Apply this check on the server to both no-final-exam completion and final-exam completion paths.
4. Keep the learner’s completion state pending after the last video when a module exam remains outstanding. After the final required approval, refresh eligibility and finish through the existing protected completion flow. Preserve courses without module exams and administrator previews.

## Technical approach
- Add one canonical server-side module-approval predicate using exam ID, learner ID and matching course, with existing authorization restrictions.
- Use an additive migration for function changes; leave historical migration files and attempts untouched.
- Update the shared module-content query to include exam IDs and correctly associate legacy attempts. Fail closed if eligibility cannot be loaded.
- Keep final-exam detection separate from overall course eligibility; merely making `track_has_exam` include module exams would incorrectly send learners to a nonexistent final exam.
- Do not revoke existing certificates or reset already-completed enrollments in this change. Report any questionable existing completions separately.

## Verification
- Regression tests: relinked same-course approval survives; unrelated/replaced exams do not approve a module; attempt counts do not change.
- Server tests: all videos complete plus last module exam pending cannot complete or issue a certificate; failed module exam remains pending; all required approvals permit completion; courses without exams retain their existing behavior.
- Verify the learner flow with isolated fixtures: last video → module exam → approval → completion, including reload and direct completion requests. Do not modify real learner progress for testing.
- Resolve each monitoring finding as fixed only after its relevant verification passes; otherwise report the remaining blocker.

## Scope
No layout changes, new exam features, automatic historical data corrections or certificate revocations.