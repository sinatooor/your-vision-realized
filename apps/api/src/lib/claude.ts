import Anthropic from "@anthropic-ai/sdk";
import { AppError, toAppError } from "./errors";

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError("Missing ANTHROPIC_API_KEY", 500, "CONFIG_ERROR");
  }

  clientInstance = new Anthropic({ apiKey });
  return clientInstance;
}

export function stripJsonFences(text: string): string {
  return text.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
}

export async function extractStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: string,
): Promise<T> {
  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `${systemPrompt}\n\nSchema:\n${schema}`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const contentBlock = response.content[0];
    const text = contentBlock && contentBlock.type === "text" ? contentBlock.text : "";

    if (!text) {
      throw new AppError("Claude returned empty content", 502, "EMPTY_MODEL_RESPONSE");
    }

    return JSON.parse(stripJsonFences(text)) as T;
  } catch (error) {
    throw toAppError(error, "Failed to extract structured data from Claude");
  }
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048,
): Promise<string> {
  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const contentBlock = response.content[0];
    return contentBlock && contentBlock.type === "text" ? contentBlock.text : "";
  } catch (error) {
    throw toAppError(error, "Failed to generate text from Claude");
  }
}
