import { formatCompactDateTime, formatDateTime, titleCase } from "./format";

describe("format utilities", () => {
  it("returns placeholder for empty datetime", () => {
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatCompactDateTime(null)).toBe("-");
  });

  it("returns input for invalid datetime", () => {
    expect(formatDateTime("invalid-value")).toBe("invalid-value");
  });

  it("converts snake case and kebab case to title case", () => {
    expect(titleCase("final_year_project_status")).toBe("Final Year Project Status");
    expect(titleCase("national-college-of-ireland")).toBe("National College Of Ireland");
  });
});
