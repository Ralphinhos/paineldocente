const { calendarDays } = require('./timing');
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = (value) => value == null ? null : Math.round(value * 10) / 10;
const byName = (a, b) => a.teacher.name.localeCompare(b.teacher.name, 'pt-BR') || a.teacher.id.localeCompare(b.teacher.id);
function delayPoints(days, policy) { return policy.delayBands.find((band) => days <= band.maxDays)?.points ?? 0; }
function teacherRanking(assignments, asOf, policy) {
  if (!policy) return { policy: null, regularity: [], priority: [], access: [], incomplete: [], teachers: [], needsValidation: 0 };
  const teachers = new Map();
  for (const assignment of assignments) {
    const entries = teachers.get(assignment.teacher.id) || [];
    entries.push(assignment); teachers.set(assignment.teacher.id, entries);
  }
  const entries = [...teachers.values()].map((courses) => {
    const ratios = []; const delays = []; const accesses = []; const accessDays = [];
    let dueItems = 0; let onTimeItems = 0; let overdue = 0; let deliveredLate = 0; let unverified = 0; let unassigned = 0; let imprecise = 0; let maxDaysLate = 0; let accessCritical = 0; let accessAttention = 0; let never = 0;
    for (const course of courses) {
      if (Object.hasOwn(policy.accessPoints, course.accessStatus)) {
        accesses.push(policy.accessPoints[course.accessStatus]);
        if (course.daysSinceAccess != null) accessDays.push(course.daysSinceAccess);
        if (course.accessStatus === 'NEVER') never++;
        if (['CRITICAL', 'NEVER'].includes(course.accessStatus)) accessCritical++;
        if (course.accessStatus === 'ATTENTION') accessAttention++;
      }
      const eligible = [];
      for (const item of course.requirements) {
        if (['substitutiva', 'tarefa_bonus'].includes(item.baseId) || ['NOT_APPLICABLE', 'INHERITED_READY'].includes(item.status) || item.responsibility === 'OTHER_TEACHER') continue;
        // The day of the deadline is still open. Early submissions do not change the denominator.
        if (item.deadlineAt && calendarDays(asOf, item.deadlineAt) <= 0) continue;
        if (item.responsibility !== 'ASSIGNED') { unassigned++; continue; }
        if (item.status === 'NOT_VERIFIABLE' || !item.deadlineAt) { unverified++; continue; }
        if (item.status === 'DELIVERED_LATE' && item.daysLate == null) imprecise++;
        eligible.push(item);
      }
      if (!eligible.length) continue;
      dueItems += eligible.length;
      const timely = eligible.filter((item) => item.status === 'DELIVERED_ON_TIME').length;
      onTimeItems += timely; ratios.push(timely / eligible.length);
      const late = eligible.filter((item) => item.status === 'DELIVERED_LATE' || item.status === 'PENDING' && item.overdue);
      const exactDelays = late.filter((item) => item.daysLate != null).map((item) => item.daysLate);
      if (exactDelays.length) delays.push(mean(exactDelays));
      overdue += eligible.filter((item) => item.status === 'PENDING' && item.overdue).length;
      deliveredLate += eligible.filter((item) => item.status === 'DELIVERED_LATE').length;
      maxDaysLate = Math.max(maxDaysLate, ...exactDelays);
    }
    const onTimeRate = mean(ratios);
    const averageDaysLate = mean(delays) ?? (dueItems ? 0 : null);
    const components = {
      onTime: onTimeRate == null ? null : onTimeRate * policy.weights.onTime,
      delay: averageDaysLate == null || imprecise ? null : delayPoints(averageDaysLate, policy),
      access: mean(accesses),
    };
    const incomplete = unverified + unassigned + imprecise > 0;
    const mode = incomplete ? 'INCOMPLETE' : !dueItems ? accesses.length ? 'ACCESS_ONLY' : 'NO_BASIS' : !accesses.length ? 'DELIVERY_ONLY' : 'COMPOSITE';
    const score = mode === 'COMPOSITE' ? components.onTime + components.delay + components.access : null;
    return {
      teacher: courses[0].teacher, courseIds: courses.map((course) => course.course.id), courseCount: courses.length,
      mode, score: round(score), components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)])),
      onTimePercent: round(onTimeRate == null ? null : onTimeRate * 100), averageDaysLate: imprecise ? null : round(averageDaysLate),
      dueItems, onTimeItems, overdue, deliveredLate, maxDaysLate, unverified, unassigned, imprecise,
      activeCourses: accesses.length, accessCritical, accessAttention, never,
      accessScore: accesses.length ? round(mean(accesses) / policy.weights.access * 100) : null,
      maxDaysSinceAccess: accessDays.length ? Math.max(...accessDays) : null,
    };
  });
  const regularity = entries.filter((entry) => entry.mode === 'COMPOSITE').sort((a, b) => b.score - a.score || byName(a, b));
  const priority = entries.filter((entry) => entry.mode === 'COMPOSITE' && (entry.score < 100 || entry.overdue || entry.accessCritical || entry.accessAttention)).sort((a, b) => a.score - b.score || b.overdue - a.overdue || b.maxDaysLate - a.maxDaysLate || b.accessCritical - a.accessCritical || byName(a, b));
  const access = entries.filter((entry) => entry.accessScore != null).sort((a, b) => a.accessScore - b.accessScore || b.never - a.never || (b.maxDaysSinceAccess ?? -1) - (a.maxDaysSinceAccess ?? -1) || byName(a, b));
  return { policy, regularity, priority, access, incomplete: entries.filter((entry) => entry.mode === 'INCOMPLETE').sort(byName), teachers: entries.sort(byName), needsValidation: entries.filter((entry) => entry.mode === 'INCOMPLETE').length };
}
module.exports = { delayPoints, teacherRanking };
