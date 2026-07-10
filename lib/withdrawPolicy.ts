/**
 * Players may withdraw themselves only until noon (Thailand time) on the play
 * date; after that the admin must do it (club charges a 100 baht fee unless a
 * replacement is found). Session dates are stored at UTC midnight, so noon
 * UTC+7 is 05:00 UTC on the same date.
 */
export function withdrawDeadline(sessionDate: Date): Date {
  return new Date(sessionDate.getTime() + 5 * 60 * 60 * 1000);
}

export function selfWithdrawAllowed(sessionDate: Date, now: Date = new Date()): boolean {
  return now.getTime() <= withdrawDeadline(sessionDate).getTime();
}
