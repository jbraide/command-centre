import { z } from 'zod';

/**
 * JSON Schema definition for a tool's input parameters.
 * Follows the JSON Schema draft-07 specification subset used by OpenAI function calling.
 */
export interface InputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  description?: string;
}

/**
 * Definition of a tool that the AI agent can invoke.
 */
export interface ToolDefinition {
  /** Unique name used by the AI to call this tool (snake_case). */
  name: string;
  /** Natural language description of what the tool does. */
  description: string;
  /** Whether this tool accesses internal data or an external service. */
  category: 'internal' | 'external';
  /** JSON Schema describing the expected input parameters. */
  inputSchema: InputSchema;
  /** Zod schema used at runtime to validate and coerce input arguments. */
  zodSchema: z.ZodTypeAny;
  /** Async handler that executes the tool logic. Must return a plain object. */
  handler: (args: any, userId: string) => Promise<any>;
}

/**
 * Singleton registry that holds all registered tools.
 *
 * Tools are registered on application startup and can be looked up
 * by name, category, or enumerated for building AI system prompts.
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a single tool. Throws if a tool with the same name already exists.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      if (process.env.NODE_ENV === 'development') {
        // Allow re-registration in dev mode (hot reload)
        return;
      }
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all registered tools.
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a single tool by name. Returns undefined if not found.
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools in a given category.
   */
  getByCategory(category: 'internal' | 'external'): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Remove all registered tools. Useful for testing or re-initialization.
   */
  clear(): void {
    this.tools.clear();
  }
}

/** Global singleton instance. */
export const toolRegistry = new ToolRegistry();
