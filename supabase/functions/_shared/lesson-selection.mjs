/**
 * @param {number} cursor
 * @param {number} lessonCount
 */
export function lessonSelectionForCursor(cursor, lessonCount) {
  if (!Number.isInteger(cursor) || cursor < 0) throw new RangeError("Tiến độ bài học phải là số nguyên không âm.");
  if (!Number.isInteger(lessonCount) || lessonCount < 0) throw new RangeError("Kích thước kho bài phải là số nguyên không âm.");
  if (lessonCount === 0) return { index: 0, round: 1, isReview: false };

  const round = Math.floor(cursor / lessonCount) + 1;
  return {
    index: cursor % lessonCount,
    round,
    isReview: round > 1,
  };
}
