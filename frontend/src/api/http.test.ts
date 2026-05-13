jest.mock("axios", () => {
  const mockAxios = {
    create: jest.fn(() => ({})),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  };
  return {
    __esModule: true,
    default: mockAxios,
    isAxiosError: mockAxios.isAxiosError,
  };
});

import { parseApiError } from "./http";

describe("parseApiError", () => {
  it("returns API detail message for axios-style errors", () => {
    const axiosLikeError = {
      isAxiosError: true,
      response: {
        data: {
          detail: "National College of Ireland API validation failed",
        },
      },
      message: "Request failed",
    };

    expect(parseApiError(axiosLikeError, "fallback message")).toBe(
      "National College of Ireland API validation failed"
    );
  });

  it("returns fallback for non-axios errors", () => {
    expect(parseApiError(new Error("plain error"), "fallback message")).toBe("fallback message");
  });
});
