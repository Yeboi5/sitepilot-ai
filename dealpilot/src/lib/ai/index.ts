import "server-only";
import { aiProviderName } from "../config";
import { AnthropicAIProvider } from "./anthropic";
import { MockAIProvider } from "./mock";
import type { AIProvider } from "./types";

let provider: AIProvider | undefined;

export function getAI(): AIProvider {
  if (!provider) provider = aiProviderName() === "anthropic" ? new AnthropicAIProvider() : new MockAIProvider();
  return provider;
}

/** Test hook. */
export function setAI(p: AIProvider) {
  provider = p;
}
