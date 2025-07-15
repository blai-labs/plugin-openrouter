import type { LanguageModelUsage } from "ai";

export interface OpenRouterConfig {
  apiKey?: string;
  baseURL?: string;
  smallModel?: string;
  largeModel?: string;
  imageModel?: string;
}

export interface GenerateTextResponse {
  text: string;
  steps?: Array<{
    stepType: string;
    text?: string;
    toolCalls?: unknown[];
    toolResults?: unknown[];
    finishReason?: string;
  }>;
  response?: {
    messages?: Array<{
      role: string;
      content?: Array<{
        type: string;
        [key: string]: unknown;
      }>;
    }>;
  };
  finishReason?: string;
  usage?: LanguageModelUsage;
}

export interface ImageDescriptionResult {
  title: string;
  description: string;
}
