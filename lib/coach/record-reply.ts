import type { CoachReply } from "./provider";
import type { TrainingSnapshot } from "./training-facts";

export const isPlanQuestion = (question: string) =>
  /\b(plan|split|routine|program(?:me)?)\b/i.test(question);

export function recordReply(
  question: string,
  snapshot: TrainingSnapshot,
): CoachReply {
  if (isPlanQuestion(question)) {
    const days = snapshot.facts
      .filter((fact) => fact.source === "Your active training plan")
      .slice(0, 7);
    if (days.length) {
      return {
        answer: `Here’s what’s in your active plan:\n\n${days.map((fact) => fact.text).join("\n\n")}\n\nTo judge how well the split works for you, I’d look at whether you recover between sessions and whether you can build reps or weight over time. Start by logging your working sets. What’s your main goal with this split?`,
        evidence: days,
      };
    }
    const plan = snapshot.facts.find(
      (fact) => fact.source === "Training plans",
    );
    return {
      answer: `${plan?.text ?? "I don’t have any training days to review in your active plan yet."} Tell me which days you train and what exercises you do, and we can talk through your split.`,
      evidence: plan ? [plan] : [],
    };
  }

  const terms = question.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const matched = snapshot.facts
    .filter(
      (fact) =>
        fact.source.startsWith("Workout ") &&
        terms.some(
          (word) =>
            fact.text.toLowerCase().split(/\W+/).includes(word) &&
            ![
              "the",
              "was",
              "did",
              "how",
              "what",
              "for",
              "last",
              "you",
              "with",
              "and",
              "workout",
              "session",
            ].includes(word),
        ),
    )
    .slice(0, 2);
  if (matched.length) {
    return {
      answer: `Here’s what I can pull from your saved workouts:\n\n${matched.map((fact) => fact.text).join("\n\n")}\n\nWhat would you like to figure out from those sets?`,
      evidence: matched,
    };
  }
  const noLogs = snapshot.facts.find((fact) =>
    fact.text.startsWith("You have no completed workouts"),
  );
  return {
    answer: noLogs
      ? "I don’t have any completed workouts to compare yet. If you tell me the exercise, weight, reps, and how many reps you had left, we can work out what to aim for next time."
      : "I couldn’t put together a reliable answer from the records I found for that question. Which exercise or training day should I look at?",
    evidence: noLogs ? [noLogs] : [],
  };
}
