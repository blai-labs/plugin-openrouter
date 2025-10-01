import type { LanguageModelUsage } from "ai";

export interface OpenRouterConfig {
  apiKey?: string;
  baseURL?: string;
  smallModel?: string;
  largeModel?: string;
  imageModel?: string;
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export interface ToolResponse {
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  steps?: Array<{
    toolCalls?: Array<{
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      input: any;
    }>;
    toolResults?: Array<{
      toolCallId: string;
      result?: any;
    }>;
    text?: string;
    finishReason?: string;
  }>;
  usage?: LanguageModelUsage;
  finishReason?: string;
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

export interface OpenRouterImageResponse {
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url: {
          url: string;
        };
      }>;
    };
  }>;
}
