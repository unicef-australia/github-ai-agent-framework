export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly response_format?: "json" | "text";
}

export interface ChatResponse {
  readonly content: string;
  readonly model?: string;
  readonly input_tokens?: number;
  readonly output_tokens?: number;
}

export interface AIProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

export type ProviderEnvironment = Readonly<Record<string, string | undefined>>;
