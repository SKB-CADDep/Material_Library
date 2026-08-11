import type { ReactNode } from "react";
import { Fragment } from "react";

const SUPERSCRIPT_TO_ASCII: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
  "¯": "-",
};

const SUPERSCRIPT_CHARS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻¯";

/** ·10⁻⁶, 10^-6, ·10¯⁶ */
const POWER_OF_TEN_PATTERN =
  /^(·?)10(?:\^([-]?\d+)|([⁻¯]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+))/;

const STANDALONE_SUPERSCRIPT_PATTERN = new RegExp(
  `^([${SUPERSCRIPT_CHARS}]+)`,
);

function superscriptRunToAscii(sign: string, digits: string): string {
  const normalizedSign = sign ? (SUPERSCRIPT_TO_ASCII[sign] ?? sign) : "";
  const normalizedDigits = [...digits]
    .map((char) => SUPERSCRIPT_TO_ASCII[char] ?? char)
    .join("");
  return `${normalizedSign}${normalizedDigits}`;
}

function findNextSpecialIndex(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    const rest = text.slice(index);
    if (POWER_OF_TEN_PATTERN.test(rest)) {
      return index;
    }
    if (STANDALONE_SUPERSCRIPT_PATTERN.test(rest)) {
      return index;
    }
  }
  return text.length;
}

export function parseScientificText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let key = 0;
  let index = 0;

  while (index < text.length) {
    const specialAt = findNextSpecialIndex(text, index);
    if (specialAt > index) {
      parts.push(text.slice(index, specialAt));
      index = specialAt;
      continue;
    }

    const rest = text.slice(index);
    const powerOfTenMatch = rest.match(POWER_OF_TEN_PATTERN);
    if (powerOfTenMatch) {
      const [, dot, caretExp, sign, superDigits] = powerOfTenMatch;
      const exponent =
        caretExp ?? superscriptRunToAscii(sign ?? "", superDigits ?? "");

      parts.push(
        <Fragment key={key}>
          {dot}10<sup>{exponent}</sup>
        </Fragment>,
      );
      key += 1;
      index += powerOfTenMatch[0].length;
      continue;
    }

    const standaloneMatch = rest.match(STANDALONE_SUPERSCRIPT_PATTERN);
    if (standaloneMatch) {
      parts.push(
        <sup key={key}>{superscriptRunToAscii("", standaloneMatch[1])}</sup>,
      );
      key += 1;
      index += standaloneMatch[1].length;
      continue;
    }

    parts.push(text[index]);
    index += 1;
  }

  if (parts.length === 0) {
    return text;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return <>{parts}</>;
}

type ScientificTextProps = {
  children: string;
  className?: string;
};

export function ScientificText({ children, className }: ScientificTextProps) {
  const classNames = className
    ? `scientific-text ${className}`
    : "scientific-text";

  return <span className={classNames}>{parseScientificText(children)}</span>;
}
