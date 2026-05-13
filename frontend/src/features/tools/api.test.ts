jest.mock("../../api/http", () => {
  return {
    http: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
    },
    parseApiError: jest.fn((_error: unknown, fallback: string) => fallback),
  };
});

import { http } from "../../api/http";
import { createTool, listTools, setToolUsable, validateTool } from "./api";

describe("tools api", () => {
  it("lists tools", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({ data: [{ id: 1, name: "Weather API" }] });

    const result = await listTools();

    expect(result).toHaveLength(1);
    expect((http.get as jest.Mock).mock.calls[0][0]).toBe("/tools");
  });

  it("validates tool payload", async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({ data: { valid: true, errors: [] } });

    const result = await validateTool({
      name: "NCI Campus Tool",
      description: "Validates payload for National College of Ireland use cases",
      inputSchema: "{}",
      outputSchema: "{}",
    });

    expect(result.valid).toBe(true);
  });

  it("updates tool usability", async () => {
    (http.patch as jest.Mock).mockResolvedValueOnce({ data: { id: 2, usable: false } });

    const result = await setToolUsable(2, false);

    expect(result.usable).toBe(false);
  });

  it("creates tool", async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({ data: { id: 4, name: "NCI Events API" } });

    const result = await createTool({
      name: "NCI Events API",
      description: "Registers National College of Ireland events lookup",
      inputSchema: "{}",
      outputSchema: "{}",
    });

    expect(result.id).toBe(4);
  });
});
