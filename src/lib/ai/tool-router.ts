import { toolRegistry } from './tool-registry';

/**
 * Result of executing a tool call.
 */
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute a tool call by name.
 *
 * 1. Looks up the tool in the registry by name.
 * 2. Validates arguments against the tool's Zod schema.
 * 3. Routes to the tool's handler function.
 * 4. Implements timeout: 10s for internal tools, 30s for external/MCP tools.
 * 5. Logs all tool calls (name, args, success/failure, duration).
 * 6. Returns a formatted result object.
 */
export async function executeToolCall(
  toolName: string,
  args: unknown,
  userId: string,
): Promise<ToolCallResult> {
  const startTime = Date.now();

  try {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      const duration = Date.now() - startTime;
      console.log(
        `[Tool Router] ${toolName} | args=${JSON.stringify(args)} | success=false | error="Tool not found" | duration=${duration}ms`,
      );
      return { success: false, error: `Tool "${toolName}" is not registered.` };
    }

    // Validate and coerce arguments using the tool's Zod schema
    const validatedArgs = tool.zodSchema.parse(args);

    // Determine timeout based on category
    const timeoutMs = tool.category === 'internal' ? 10_000 : 30_000;

    // Execute with race-against-timeout
    const data = await Promise.race([
      tool.handler(validatedArgs, userId),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);

    const duration = Date.now() - startTime;
    console.log(
      `[Tool Router] ${toolName} | args=${JSON.stringify(args)} | success=true | duration=${duration}ms`,
    );

    return { success: true, data };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';

    console.log(
      `[Tool Router] ${toolName} | args=${JSON.stringify(args)} | success=false | error="${message}" | duration=${duration}ms`,
    );

    // If it's a Zod validation error, extract the issues for a clearer message
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
      const details = zodError.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return { success: false, error: `Validation failed: ${details}` };
    }

    return { success: false, error: message };
  }
}
