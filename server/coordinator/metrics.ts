export type AcceptanceTiming = { createdAt: Date; acceptedAt: Date | null };

export function averageAcceptanceMinutes(items: AcceptanceTiming[]) {
  const durations = items.flatMap(item => {
    if (!item.acceptedAt) return [];
    const duration = item.acceptedAt.getTime() - item.createdAt.getTime();
    return duration >= 0 ? [duration / 60_000] : [];
  });
  if (!durations.length) return null;
  return Math.round((durations.reduce((total, duration) => total + duration, 0) / durations.length) * 10) / 10;
}

export function coordinatorPriority(status: string, severity: string) {
  const severityWeight = severity === "critical" ? 40 : severity === "urgent" ? 30 : severity === "standard" ? 20 : 10;
  const statusWeight = status === "searching" ? 8 : status === "accepted" ? 6 : status === "en_route" ? 4 : status === "arrived" || status === "assisting" ? 2 : 0;
  return severityWeight + statusWeight;
}
