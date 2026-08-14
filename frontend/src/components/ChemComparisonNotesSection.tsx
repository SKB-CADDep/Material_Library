import type { ChemSourceColumn } from "../lib/chemComparisonPivot";

type ChemComparisonNoteEntry = {
  key: string;
  label: string;
  note: string;
};

export function collectChemComparisonNotes(
  columns: ChemSourceColumn[],
): ChemComparisonNoteEntry[] {
  return columns.flatMap((column) => {
    const note = column.note.trim();
    if (!note) {
      return [];
    }
    return [{ key: column.key, label: column.label, note }];
  });
}

type ChemComparisonNotesSectionProps = {
  columns: ChemSourceColumn[];
};

export function ChemComparisonNotesSection({
  columns,
}: ChemComparisonNotesSectionProps) {
  const notes = collectChemComparisonNotes(columns);

  if (notes.length === 0) {
    return null;
  }

  return (
    <section
      className="chem-comparison-panel chem-comparison-panel--notes"
      aria-labelledby="chem-comparison-notes-title"
    >
      <h3
        id="chem-comparison-notes-title"
        className="chem-comparison-panel-title"
      >
        Примечания к источникам
      </h3>
      <ul className="chem-comparison-notes-list">
        {notes.map((entry) => (
          <li key={entry.key} className="chem-comparison-notes-item">
            <p className="chem-comparison-notes-source">{entry.label}</p>
            <pre className="chem-comparison-notes-text">{entry.note}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
