import { isPlanQuestion } from "./record-reply";

const personalRecords =
  /\b(?:my|our)\s+(?:(?:current|active|saved|recent|last|previous|training|workout|weekly|best|personal)\s+)*(?:plan|split|routine|program(?:me)?|logs?|history|progress|workouts?|sessions?|sets?|reps|weights?|body\s*weight|records?|performance|targets?|notes?|goals?|pr(?:s)?|bench|deadlift|squat|press|pull.?up)\b|\bwhat (?:did|have|was|were) i\b|\b(?:last|previous)\s+(?:week|session|workout|time)\b|\b(?:did i|have i)\s+(?:log|improv|progress|lift|do|hit|gain)\w*\b|\b(?:should|can|do) i (?:up|increase|add|progress|repeat|drop|lower|reduce)\b|\b(?:based on|compare|check|review|look at)\b.{0,35}\b(?:logged|recorded|saved)\b/i;
const followUp =
  /^(?:(?:and|so|then|but)\s+|(?:what|how) about\b|(?:yes|yeah|sure|okay)\b|(?:can you )?(?:explain|elaborate|show me|tell me more)\b|.*\b(?:it|that|those|these|them)\??$)/i;

export function coachNeedsRecords(
  question: string,
  previousQuestion?: string,
): boolean {
  if (personalRecords.test(question)) return true;
  if (
    isPlanQuestion(question) &&
    /\b(?:review|rate|thoughts on|think of|think about|look at|show me)\b/i.test(
      question,
    ) &&
    !/\b(?:a|an|the)\s+(?:good|new|beginner|push|upper|full|training|workout)\b/i.test(
      question,
    ) &&
    !/\b(?:push.pull.legs|ppl|upper.lower|full.body)\b/i.test(question)
  )
    return true;
  return Boolean(
    previousQuestion &&
    followUp.test(question.trim()) &&
    coachNeedsRecords(previousQuestion),
  );
}

export function generalTrainingReply(question: string): string {
  if (
    /^(?:hey|hi|hello|yo|good (?:morning|evening))(?:\s+(?:coach|there))?[!.\s]*$/i.test(
      question.trim(),
    )
  )
    return "Hey! What are you working on today? We can talk through exercises, sets and reps, or how to build up your lifts.";
  if (
    /\b(?:progressive overload|progression|increase (?:the )?weight|add (?:more )?reps|rep ranges?)\b/i.test(
      question,
    )
  )
    return "Start with a rep range you can train with steady form. For example, if your target is 8–12 reps, keep the load the same and try to add a rep to one working set. When every working set reaches 12 with room for another rep, try the smallest weight increase and build back up through the range. What exercise are you working on?";
  if (/\b(?:rir|reps? in reserve|reps? left)\b/i.test(question))
    return "Reps in reserve means how many more reps you think you could do with good form. If you stop after 8 reps and could have managed about 2 more, that’s 2 reps in reserve. It’s an estimate, and it usually gets easier to judge with practice.";
  if (
    /\b(?:rest|break)\b.*\bsets\b|\bsets\b.*\b(?:rest|break)\b/i.test(question)
  )
    return "Rest long enough to make the next set productive. For heavy compound lifts, 2–3 minutes is a useful starting point. For lighter isolation work, 1–2 minutes may be enough. Take a little longer if short rests make your reps or form fall off.";
  if (/\b(?:push.pull.legs|ppl|upper.lower|full.body|split)\b/i.test(question))
    return "Pick a split around the days you can train consistently. Full-body sessions often fit fewer training days, while upper/lower or push/pull/legs can spread the work over more sessions. How many days can you reliably make it to the gym?";
  return "I couldn’t get a full coaching reply right now. If you’re building a workout, start with the movement you want to improve and a workload you can repeat with good form. Which exercise or training goal would you like to focus on?";
}
