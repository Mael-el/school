import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';

export type Section = 'Francophone' | 'Anglophone';

export interface ClassLevelLabel {
  section: Section;
  name: string;
}

export interface ClassLevelStructured {
  id: number;
  code: string;
  display_order: number;
  /** Legacy fallback — francophone label or code. */
  name: string;
  labels: ClassLevelLabel[];
}

export interface UpsertClassLevelInput {
  id?: number;
  code: string;
  display_order: number;
  labels: {
    francophone?: string | null;
    anglophone?: string | null;
  };
}

function primaryName(labels: UpsertClassLevelInput['labels'], code: string): string {
  return labels.francophone?.trim() || labels.anglophone?.trim() || code;
}

export class ClassLevelService {
  constructor(private readonly db: Kysely<Database>) {}

  async listStructured(): Promise<ClassLevelStructured[]> {
    const levels = await this.db
      .selectFrom('class_levels')
      .selectAll()
      .orderBy('display_order')
      .execute();

    const labelRows = await this.db
      .selectFrom('class_level_labels')
      .selectAll()
      .execute();

    const labelsByLevel = new Map<number, ClassLevelLabel[]>();
    for (const row of labelRows) {
      const list = labelsByLevel.get(row.class_level_id) ?? [];
      list.push({ section: row.section, name: row.name });
      labelsByLevel.set(row.class_level_id, list);
    }

    return levels.map((level) => ({
      id: level.id,
      code: level.code ?? level.name,
      display_order: level.display_order,
      name: level.name,
      labels: labelsByLevel.get(level.id) ?? [],
    }));
  }

  async upsertStructured(input: UpsertClassLevelInput): Promise<number> {
    const name = primaryName(input.labels, input.code);

    let levelId = input.id;
    if (levelId) {
      await this.db
        .updateTable('class_levels')
        .set({
          code: input.code,
          display_order: input.display_order,
          name,
        })
        .where('id', '=', levelId)
        .execute();
    } else {
      const result = await this.db
        .insertInto('class_levels')
        .values({
          code: input.code,
          display_order: input.display_order,
          name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      levelId = Number(result.id);
    }

    await this.syncLabels(levelId, input.labels);
    await this.syncAliases(levelId, input.labels);
    return levelId;
  }

  private async syncLabels(
    levelId: number,
    labels: UpsertClassLevelInput['labels'],
  ): Promise<void> {
    const entries: Array<{ section: Section; name: string }> = [];
    if (labels.francophone?.trim()) {
      entries.push({ section: 'Francophone', name: labels.francophone.trim() });
    }
    if (labels.anglophone?.trim()) {
      entries.push({ section: 'Anglophone', name: labels.anglophone.trim() });
    }

    await this.db
      .deleteFrom('class_level_labels')
      .where('class_level_id', '=', levelId)
      .execute();

    for (const entry of entries) {
      await this.db
        .insertInto('class_level_labels')
        .values({
          class_level_id: levelId,
          section: entry.section,
          name: entry.name,
        })
        .execute();
    }
  }

  private async syncAliases(
    levelId: number,
    labels: UpsertClassLevelInput['labels'],
  ): Promise<void> {
    await this.db
      .deleteFrom('class_name_aliases')
      .where('class_level_id', '=', levelId)
      .execute();

    if (labels.francophone?.trim()) {
      await this.upsertAlias(labels.francophone.trim(), levelId, 'Francophone');
    }
    if (labels.anglophone?.trim()) {
      await this.upsertAlias(labels.anglophone.trim(), levelId, 'Anglophone');
    }
  }

  async upsertAlias(
    alias: string,
    classLevelId: number,
    section: Section,
  ): Promise<void> {
    await this.db
      .insertInto('class_name_aliases')
      .values({ alias, class_level_id: classLevelId, section })
      .onConflict((oc) =>
        oc.column('alias').doUpdateSet({
          class_level_id: classLevelId,
          section,
        }),
      )
      .execute();
  }

  async resolveFromAlias(
    alias: string,
  ): Promise<{ class_level_id: number; section: Section } | undefined> {
    const row = await this.db
      .selectFrom('class_name_aliases')
      .select(['class_level_id', 'section'])
      .where('alias', '=', alias)
      .executeTakeFirst();
    if (!row) return undefined;
    return { class_level_id: row.class_level_id, section: row.section };
  }

  labelForSection(
    level: ClassLevelStructured,
    section: Section | null | undefined,
  ): string {
    if (section) {
      const match = level.labels.find((l) => l.section === section);
      if (match) return match.name;
    }
    const fr = level.labels.find((l) => l.section === 'Francophone');
    if (fr) return fr.name;
    return level.labels[0]?.name ?? level.name;
  }

  /** Removes one section's class from a level; deletes the level if none remain. */
  async removeSectionClass(levelId: number, section: Section): Promise<void> {
    const label = await this.db
      .selectFrom('class_level_labels')
      .select('id')
      .where('class_level_id', '=', levelId)
      .where('section', '=', section)
      .executeTakeFirst();
    if (!label) return;

    await this.db
      .deleteFrom('class_level_labels')
      .where('class_level_id', '=', levelId)
      .where('section', '=', section)
      .execute();
    await this.db
      .deleteFrom('class_name_aliases')
      .where('class_level_id', '=', levelId)
      .where('section', '=', section)
      .execute();
    await this.db
      .deleteFrom('class_fees')
      .where('class_level_id', '=', levelId)
      .where('section', '=', section)
      .execute();

    const remaining = await this.db
      .selectFrom('class_level_labels')
      .select('id')
      .where('class_level_id', '=', levelId)
      .executeTakeFirst();

    if (!remaining) {
      await this.deleteLevel(levelId);
    }
  }

  private async deleteLevel(levelId: number): Promise<void> {
    const enrollment = await this.db
      .selectFrom('enrollments')
      .select('id')
      .where('class_level_id', '=', levelId)
      .executeTakeFirst();
    if (enrollment) {
      throw new Error(
        'Impossible de supprimer cette classe : des inscriptions y sont rattachées.',
      );
    }

    const staff = await this.db
      .selectFrom('staff_members')
      .select('id')
      .where('class_level_id', '=', levelId)
      .executeTakeFirst();
    if (staff) {
      throw new Error(
        'Impossible de supprimer cette classe : du personnel y est rattaché.',
      );
    }

    await this.db
      .deleteFrom('class_fees')
      .where('class_level_id', '=', levelId)
      .execute();
    await this.db
      .deleteFrom('class_level_labels')
      .where('class_level_id', '=', levelId)
      .execute();
    await this.db
      .deleteFrom('class_name_aliases')
      .where('class_level_id', '=', levelId)
      .execute();
    await this.db
      .deleteFrom('class_levels')
      .where('id', '=', levelId)
      .execute();
  }
}
