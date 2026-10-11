import type { ClassLevelStructured } from './types';

/** Display name for a logical level in the given section. */
export function labelForSection(
  level: ClassLevelStructured,
  section: 'Francophone' | 'Anglophone' | null | undefined,
): string {
  if (section) {
    const match = level.labels.find((l) => l.section === section);
    if (match) return match.name;
  }
  const francophone = level.labels.find((l) => l.section === 'Francophone');
  if (francophone) return francophone.name;
  return level.labels[0]?.name ?? level.name;
}

/** Levels that offer a label in the selected section (empty section → all). */
export function levelsForSection(
  levels: ClassLevelStructured[],
  section: 'Francophone' | 'Anglophone' | '' | null | undefined,
): ClassLevelStructured[] {
  if (!section) return levels;
  return levels.filter((l) =>
    l.labels.some((lab) => lab.section === section),
  );
}
