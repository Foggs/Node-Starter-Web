import type { Scenario } from "@workspace/api-zod";

export const scenarios: readonly Scenario[] = [
  {
    id: "performance_issue",
    name: "Performance Issue",
    description:
      "An employee has missed targets for three consecutive quarters despite two prior coaching sessions. You must deliver a clear, direct assessment of the performance gap and outline consequences if the pattern continues.",
  },
  {
    id: "layoff",
    name: "Position Elimination",
    description:
      "The employee's role is being eliminated as part of a company-wide restructure. There is no performance reason. You must communicate the decision compassionately, cover severance terms, and handle a range of emotional reactions.",
  },
  {
    id: "misconduct",
    name: "Gross Misconduct",
    description:
      "A serious policy violation has been substantiated following an HR investigation. You must deliver the outcome calmly and professionally, avoid argumentation, and follow the documented procedure to the letter.",
  },
  {
    id: "pip_failure",
    name: "PIP Failure",
    description:
      "The employee has not met the milestones defined in their Performance Improvement Plan over the last 60 days. You must close the PIP, explain what was not met, and initiate the separation in accordance with company policy.",
  },
] as const;
