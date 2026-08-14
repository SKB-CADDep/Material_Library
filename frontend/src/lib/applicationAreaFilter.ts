export function materialMatchesApplicationAreas(
  materialAreas: string[] | undefined,
  selectedAreas: string[],
): boolean {
  if (selectedAreas.length === 0) {
    return true;
  }
  const areas = materialAreas ?? [];
  return areas.some((area) => selectedAreas.includes(area));
}
