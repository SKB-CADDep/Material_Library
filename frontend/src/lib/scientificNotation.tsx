import type { ReactNode } from "react";
import { Fragment } from "react";
import katex from "katex";

export type ScientificToken =
  | { type: "text"; value: string }
  | { type: "sup"; value: string }
  | { type: "sub"; value: string };

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
  "⁺": "+",
};

const SUBSCRIPT_TO_ASCII: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "₋": "-",
  "₊": "+",
};

const ASCII_TO_SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "+": "⁺",
};

const ASCII_TO_SUBSCRIPT: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "-": "₋",
  "+": "₊",
};

const SUPERSCRIPT_CHARS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻¯⁺";
const SUBSCRIPT_CHARS = "₀₁₂₃₄₅₆₇₈₉₋₊";

/** ·10⁻⁶, 10^-6, ·10¯⁶ */
const POWER_OF_TEN_PATTERN =
  /^(·?)10(?:\^([-]?\d+)|([⁻¯]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+))/;

/** 10e7, ·10e-6, 10E7 */
const SCIENTIFIC_E_PATTERN = /^(·?)10[eE]([+-]?\d+)/;

/** σ_0,2, σ_в, σ_дп_10, σ_-1 */
const UNDERSCORE_SUB_PATTERN =
  /^_(-?[A-Za-zА-Яа-яёЁ0-9]+(?:,[0-9]+)?)/;

/** σ-1 в display_symbol */
const GREEK_HYPHEN_SUB_PATTERN = /^([σαδψλρβE])-(\d+)/;

/** кг/м3, Дж/см2, N/mm2 */
const UNIT_POWER_PATTERN = /^(см|мм|км|м|фут|in)([23])/i;

const STANDALONE_SUPERSCRIPT_PATTERN = new RegExp(
  `^([${SUPERSCRIPT_CHARS}]+)`,
);

const STANDALONE_SUBSCRIPT_PATTERN = new RegExp(
  `^([${SUBSCRIPT_CHARS}]+)`,
);

function superscriptRunToAscii(sign: string, digits: string): string {
  const normalizedSign = sign ? (SUPERSCRIPT_TO_ASCII[sign] ?? sign) : "";
  const normalizedDigits = [...digits]
    .map((char) => SUPERSCRIPT_TO_ASCII[char] ?? char)
    .join("");
  return `${normalizedSign}${normalizedDigits}`;
}

function mapChars(text: string, table: Record<string, string>): string {
  return [...text].map((char) => table[char] ?? char).join("");
}

function subscriptRunToAscii(digits: string): string {
  return mapChars(digits, SUBSCRIPT_TO_ASCII);
}

function isSpecialStart(rest: string): boolean {
  return (
    SCIENTIFIC_E_PATTERN.test(rest) ||
    POWER_OF_TEN_PATTERN.test(rest) ||
    UNDERSCORE_SUB_PATTERN.test(rest) ||
    GREEK_HYPHEN_SUB_PATTERN.test(rest) ||
    STANDALONE_SUPERSCRIPT_PATTERN.test(rest) ||
    STANDALONE_SUBSCRIPT_PATTERN.test(rest) ||
    UNIT_POWER_PATTERN.test(rest)
  );
}

function findNextSpecialIndex(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (isSpecialStart(text.slice(index))) {
      return index;
    }
  }
  return text.length;
}

function pushText(tokens: ScientificToken[], value: string): void {
  if (!value) {
    return;
  }
  const last = tokens[tokens.length - 1];
  if (last?.type === "text") {
    last.value += value;
    return;
  }
  tokens.push({ type: "text", value });
}

export function tokenizeScientificText(text: string): ScientificToken[] {
  const tokens: ScientificToken[] = [];
  let index = 0;

  while (index < text.length) {
    const specialAt = findNextSpecialIndex(text, index);
    if (specialAt > index) {
      pushText(tokens, text.slice(index, specialAt));
      index = specialAt;
      continue;
    }

    const rest = text.slice(index);

    const scientificEMatch = rest.match(SCIENTIFIC_E_PATTERN);
    if (scientificEMatch) {
      pushText(tokens, `${scientificEMatch[1] ?? ""}10`);
      tokens.push({ type: "sup", value: scientificEMatch[2] });
      index += scientificEMatch[0].length;
      continue;
    }

    const powerOfTenMatch = rest.match(POWER_OF_TEN_PATTERN);
    if (powerOfTenMatch) {
      const [, dot, caretExp, sign, superDigits] = powerOfTenMatch;
      const exponent =
        caretExp ?? superscriptRunToAscii(sign ?? "", superDigits ?? "");
      pushText(tokens, `${dot}10`);
      tokens.push({ type: "sup", value: exponent });
      index += powerOfTenMatch[0].length;
      continue;
    }

    const underscoreMatch = rest.match(UNDERSCORE_SUB_PATTERN);
    if (underscoreMatch) {
      tokens.push({ type: "sub", value: underscoreMatch[1] });
      index += underscoreMatch[0].length;
      continue;
    }

    const greekHyphenMatch = rest.match(GREEK_HYPHEN_SUB_PATTERN);
    if (greekHyphenMatch) {
      pushText(tokens, greekHyphenMatch[1]);
      tokens.push({ type: "sub", value: `-${greekHyphenMatch[2]}` });
      index += greekHyphenMatch[0].length;
      continue;
    }

    const standaloneSuperMatch = rest.match(STANDALONE_SUPERSCRIPT_PATTERN);
    if (standaloneSuperMatch) {
      tokens.push({
        type: "sup",
        value: superscriptRunToAscii("", standaloneSuperMatch[1]),
      });
      index += standaloneSuperMatch[1].length;
      continue;
    }

    const standaloneSubMatch = rest.match(STANDALONE_SUBSCRIPT_PATTERN);
    if (standaloneSubMatch) {
      tokens.push({
        type: "sub",
        value: subscriptRunToAscii(standaloneSubMatch[1]),
      });
      index += standaloneSubMatch[1].length;
      continue;
    }

    const unitPowerMatch = rest.match(UNIT_POWER_PATTERN);
    if (unitPowerMatch) {
      pushText(tokens, unitPowerMatch[1]);
      tokens.push({ type: "sup", value: unitPowerMatch[2] });
      index += unitPowerMatch[0].length;
      continue;
    }

    pushText(tokens, text[index]);
    index += 1;
  }

  return tokens;
}

const GREEK_TO_LATEX: Record<string, string> = {
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  Δ: "\\Delta",
  ε: "\\varepsilon",
  θ: "\\theta",
  λ: "\\lambda",
  μ: "\\mu",
  π: "\\pi",
  ρ: "\\rho",
  σ: "\\sigma",
  τ: "\\tau",
  φ: "\\varphi",
  ψ: "\\psi",
  ω: "\\omega",
  Σ: "\\Sigma",
  Ω: "\\Omega",
};

function escapeLatexText(value: string): string {
  return value.replace(/[\\{}$&#^_%]/g, (char) => `\\${char}`);
}

function isTextRunChar(char: string): boolean {
  return char === "°" || /[A-Za-zА-Яа-яёЁ]/.test(char);
}

function textToLatex(value: string): string {
  let latex = "";
  const chars = [...value];
  let index = 0;
  while (index < chars.length) {
    const char = chars[index];
    const greek = GREEK_TO_LATEX[char];
    if (greek) {
      latex += greek;
      index += 1;
      continue;
    }
    if (char === "·" || char === "∙") {
      latex += "\\cdot ";
      index += 1;
      continue;
    }
    if (char === " ") {
      latex += "\\ ";
      index += 1;
      continue;
    }
    if (char === "%") {
      latex += "\\%";
      index += 1;
      continue;
    }
    if (isTextRunChar(char)) {
      let run = "";
      while (
        index < chars.length &&
        isTextRunChar(chars[index]) &&
        !GREEK_TO_LATEX[chars[index]]
      ) {
        run += chars[index];
        index += 1;
      }
      latex += `\\text{${escapeLatexText(run)}}`;
      continue;
    }
    latex += char;
    index += 1;
  }
  return latex;
}

function scriptToLatex(value: string): string {
  if (/^[0-9,+\-]+$/.test(value)) {
    return value;
  }
  return `\\text{${escapeLatexText(value)}}`;
}

export function toLatex(text: string): string {
  const tokens = tokenizeScientificText(text);
  let latex = "";
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "sub") {
      const parts = [scriptToLatex(token.value)];
      while (tokens[index + 1]?.type === "sub") {
        index += 1;
        parts.push(scriptToLatex(tokens[index].value));
      }
      latex += `_{${parts.join(",")}}`;
      index += 1;
      continue;
    }
    if (token.type === "sup") {
      latex += `^{${scriptToLatex(token.value)}}`;
      index += 1;
      continue;
    }
    latex += textToLatex(token.value);
    index += 1;
  }
  return latex;
}

const KATEX_OPTIONS = {
  throwOnError: false,
  displayMode: false,
  output: "html" as const,
  strict: "ignore" as const,
};

export function renderLatexHtml(text: string): string {
  const latex = toLatex(text);
  if (!latex) {
    return "";
  }
  try {
    return katex.renderToString(`\\boldsymbol{${latex}}`, KATEX_OPTIONS);
  } catch {
    return "";
  }
}

export function parseScientificText(text: string): ReactNode {
  const tokens = tokenizeScientificText(text);
  if (tokens.length === 0) {
    return text;
  }
  if (tokens.length === 1 && tokens[0].type === "text") {
    return tokens[0].value;
  }

  return tokens.map((token, key) => {
    if (token.type === "text") {
      return <Fragment key={key}>{token.value}</Fragment>;
    }
    if (token.type === "sup") {
      return <sup key={key}>{token.value}</sup>;
    }
    return <sub key={key}>{token.value}</sub>;
  });
}


export function formatScientificPlain(text: string): string {
  return tokenizeScientificText(text)
    .map((token) => {
      if (token.type === "text") {
        return token.value;
      }
      if (token.type === "sup") {
        return mapChars(token.value, ASCII_TO_SUPERSCRIPT);
      }
      return mapChars(token.value, ASCII_TO_SUBSCRIPT);
    })
    .join("");
}

type ScientificTextProps = {
  children: string;
  className?: string;
};

export function ScientificText({ children, className }: ScientificTextProps) {
  const classNames = className
    ? `scientific-text ${className}`
    : "scientific-text";
  const html = renderLatexHtml(children);

  if (!html) {
    return <span className={classNames}>{parseScientificText(children)}</span>;
  }

  return (
    <span
      className={classNames}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type ScientificSvgRunsProps = {
  text: string;
};

export function ScientificSvgRuns({ text }: ScientificSvgRunsProps) {
  const tokens = tokenizeScientificText(text);
  if (tokens.length === 1 && tokens[0].type === "text") {
    return <>{tokens[0].value}</>;
  }

  return (
    <>
      {tokens.map((token, key) => {
        if (token.type === "text") {
          return (
            <tspan key={key} baselineShift="baseline">
              {token.value}
            </tspan>
          );
        }
        return (
          <tspan
            key={key}
            baselineShift={token.type === "sup" ? "super" : "sub"}
            fontSize="0.72em"
          >
            {token.value}
          </tspan>
        );
      })}
    </>
  );
}
