import { useEffect, useLayoutEffect, useRef, useState } from "react";

type PropertyCommentFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

function syncTextareaHeight(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function PropertyCommentField({ id, value, onChange }: PropertyCommentFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      syncTextareaHeight(textareaRef.current);
    }
  }, [editing, draft, value]);

  return (
    <textarea
      ref={textareaRef}
      id={id}
      rows={2}
      value={editing ? draft : value}
      className="input property-field-multiline"
      onFocus={() => {
        setEditing(true);
        setDraft(value);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        syncTextareaHeight(event.target);
      }}
      onBlur={(event) => {
        const next = event.target.value;
        setEditing(false);
        setDraft(next);
        if (next !== value) {
          onChange(next);
        }
      }}
    />
  );
}
