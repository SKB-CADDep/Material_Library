import {
  useEffect,
  useState,
  type FocusEventHandler,
  type InputHTMLAttributes,
} from "react";

type BlurCommitTextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue"
> & {
  value: string;
  /** Пишется в родительский draft только на blur (и при Enter). */
  onCommit: (raw: string) => void;
  /** Если false — не вызывать onCommit, когда текст не изменился. По умолчанию true. */
  commitWhenUnchanged?: boolean;
};

/**
 * Controlled-инпут с локальным черновиком на время фокуса.
 * Родитель не перерисовывается на каждый keystroke — только после commit.
 */
export function BlurCommitTextInput({
  value,
  onCommit,
  commitWhenUnchanged = true,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: BlurCommitTextInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  const commit = (raw: string) => {
    if (!commitWhenUnchanged && raw === value) {
      return;
    }
    onCommit(raw);
  };

  const handleFocus: FocusEventHandler<HTMLInputElement> = (event) => {
    if (rest.readOnly || rest.disabled) {
      onFocus?.(event);
      return;
    }
    setEditing(true);
    setDraft(value);
    onFocus?.(event);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    if (rest.readOnly || rest.disabled) {
      onBlur?.(event);
      return;
    }
    const raw = event.target.value;
    setEditing(false);
    setDraft(raw);
    commit(raw);
    onBlur?.(event);
  };

  return (
    <input
      {...rest}
      value={editing ? draft : value}
      onFocus={handleFocus}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        onKeyDown?.(event);
      }}
    />
  );
}
