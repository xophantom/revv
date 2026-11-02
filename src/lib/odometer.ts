// A record this far past the odometer is almost surely a typo (an extra zero). Saving it would
// move the odometer there and flag every km alert as overdue (and e-mail about it).
export const MAX_ODOMETER_JUMP = 50_000;

export function odometerJumpError(currentKm: number, km: number): string | null {
  if (km <= currentKm + MAX_ODOMETER_JUMP) return null;
  return `Km muito acima do odômetro atual (${currentKm.toLocaleString("pt-BR")} km). Confira o valor ou atualize o odômetro antes.`;
}
