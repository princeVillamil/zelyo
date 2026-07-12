import type { Attributes } from "@zelyo/zk-shared";

/** Human labels for every credential attribute — shared by the privacy panels and proof receipt. */
export const ALL_ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  learnerName: "Name",
  courseName: "Course",
  grade: "Grade",
  track: "Track",
  issueDate: "Issue Date",
};
