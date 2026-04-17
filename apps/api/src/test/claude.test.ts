import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractStructured } from "../lib/claude";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: createMock,
    };
  }

  return { default: MockAnthropic };
});

describe("extractStructured", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMock.mockReset();
  });

  it("parses fenced JSON content from Claude", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "```json\n{\"ok\":true,\"count\":2}\n```",
        },
      ],
    });

    const result = await extractStructured<{ ok: boolean; count: number }>(
      "system",
      "user",
      "{ ok: boolean; count: number }",
    );

    expect(result).toEqual({ ok: true, count: 2 });
  });
});
