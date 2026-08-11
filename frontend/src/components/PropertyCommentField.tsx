import { useLayoutEffect, useRef } from "react";

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

  useLayoutEffect(() => {
    if (textareaRef.current) {
      syncTextareaHeight(textareaRef.current);
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      id={id}
      rows={2}
      value={value}
      className="input property-field-multiline"
      onChange={(event) => {
        onChange(event.target.value);
        syncTextareaHeight(event.target);
      }}
    />
  );
}
