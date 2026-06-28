import type { Tool } from "@google/generative-ai";

export interface ToolHandler {
  /** The Gemini Tool schema (functionDeclarations) */
  schema: Tool;
  /** Handler for all function names declared in schema */
  dispatch: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolRegistry {
  tools: Tool[];
  dispatch: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Merges multiple tool handlers into a single registry for runAgent.
 */
export function buildRegistry(handlers: ToolHandler[]): ToolRegistry {
  const tools = handlers.map((h) => h.schema);

  async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
    for (const handler of handlers) {
      // Cast: functionDeclarations exists at runtime but may be absent from the SDK's type def
      const s = handler.schema as { functionDeclarations?: { name: string }[] };
      const declared = s.functionDeclarations ?? [];
      if (declared.some((f) => f.name === name)) {
        return handler.dispatch(name, args);
      }
    }
    return { error: `Unknown tool: ${name}` };
  }

  return { tools, dispatch };
}
