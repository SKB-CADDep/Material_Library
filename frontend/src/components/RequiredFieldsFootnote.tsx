import { RequiredMark } from "./RequiredMark";

export function RequiredFieldsFootnote() {
  return (
    <p className="form-footnote">
      <RequiredMark /> — обязательное поле для сохранения материала
    </p>
  );
}
