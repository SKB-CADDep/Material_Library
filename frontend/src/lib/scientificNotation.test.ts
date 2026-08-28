import { describe, expect, it } from "vitest";
import {
  formatScientificPlain,
  renderLatexHtml,
  toLatex,
  tokenizeScientificText,
} from "./scientificNotation";

describe("tokenizeScientificText", () => {
  it("keeps plain greek symbols", () => {
    expect(tokenizeScientificText("ρ")).toEqual([{ type: "text", value: "ρ" }]);
    expect(tokenizeScientificText("α")).toEqual([{ type: "text", value: "α" }]);
  });

  it("parses caret and unicode powers of ten", () => {
    expect(tokenizeScientificText("10^-6")).toEqual([
      { type: "text", value: "10" },
      { type: "sup", value: "-6" },
    ]);
    expect(tokenizeScientificText("·10⁻⁶")).toEqual([
      { type: "text", value: "·10" },
      { type: "sup", value: "-6" },
    ]);
  });

  it("parses 10e7 and 10e-6", () => {
    expect(tokenizeScientificText("N=10e7")).toEqual([
      { type: "text", value: "N=10" },
      { type: "sup", value: "7" },
    ]);
    expect(tokenizeScientificText("10e-6")).toEqual([
      { type: "text", value: "10" },
      { type: "sup", value: "-6" },
    ]);
  });

  it("parses underscore subscripts", () => {
    expect(tokenizeScientificText("σ_0,2")).toEqual([
      { type: "text", value: "σ" },
      { type: "sub", value: "0,2" },
    ]);
    expect(tokenizeScientificText("σ_в")).toEqual([
      { type: "text", value: "σ" },
      { type: "sub", value: "в" },
    ]);
    expect(tokenizeScientificText("σ_дп_10")).toEqual([
      { type: "text", value: "σ" },
      { type: "sub", value: "дп" },
      { type: "sub", value: "10" },
    ]);
  });

  it("parses fatigue display_symbol", () => {
    expect(tokenizeScientificText("σ-1 гладкий, N=10e7")).toEqual([
      { type: "text", value: "σ" },
      { type: "sub", value: "-1" },
      { type: "text", value: " гладкий, N=10" },
      { type: "sup", value: "7" },
    ]);
  });

  it("raises trailing 2/3 in raw unit keys", () => {
    expect(tokenizeScientificText("кг/м3")).toEqual([
      { type: "text", value: "кг/м" },
      { type: "sup", value: "3" },
    ]);
    expect(tokenizeScientificText("Дж/см2")).toEqual([
      { type: "text", value: "Дж/см" },
      { type: "sup", value: "2" },
    ]);
  });
});

describe("toLatex", () => {
  it("maps catalog symbols to TeX", () => {
    expect(toLatex("ρ")).toBe("\\rho");
    expect(toLatex("α")).toBe("\\alpha");
    expect(toLatex("σ_0,2")).toBe("\\sigma_{0,2}");
    expect(toLatex("σ_в")).toBe("\\sigma_{\\text{в}}");
    expect(toLatex("σ_дп_10")).toBe("\\sigma_{\\text{дп},10}");
    expect(toLatex("кг/м3")).toBe("\\text{кг}/\\text{м}^{3}");
    expect(toLatex("10^-6")).toBe("10^{-6}");
    expect(toLatex("N=10e7")).toBe("\\text{N}=10^{7}");
    expect(toLatex("10⁻⁶/°C")).toBe("10^{-6}/\\text{°C}");
  });

  it("renders KaTeX HTML for catalog symbols", () => {
    const html = renderLatexHtml("σ_0,2");
    expect(html).toContain("katex");
    expect(html).not.toContain("katex-error");
    expect(renderLatexHtml("кг/м³")).toContain("katex");
    expect(renderLatexHtml("ρ")).toContain("katex");
  });
});

describe("formatScientificPlain", () => {
  it("uses unicode for select and SVG fallback", () => {
    expect(formatScientificPlain("кг/м3")).toBe("кг/м³");
    expect(formatScientificPlain("10^-6/C")).toBe("10⁻⁶/C");
    expect(formatScientificPlain("σ_0,2")).toBe("σ₀,₂");
    expect(formatScientificPlain("σ_в")).toBe("σв");
    expect(formatScientificPlain("N=10e7")).toBe("N=10⁷");
  });
});
