export function formatRelative(iso: string, now = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff <= 0) return 'agora';
  if (abs < hour) return `em ${Math.max(1, Math.round(abs / min))} min`;
  if (abs < day) return `em ${Math.round(abs / hour)} h`;
  const days = Math.round(abs / day);
  if (days === 1) return 'amanhã';
  if (days < 30) return `em ${days} dias`;
  const months = Math.round(days / 30);
  if (months < 12) return `em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.round(days / 365);
  return `em ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

