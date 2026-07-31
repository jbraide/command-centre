import { executeToolCall } from './tool-router';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying';

export interface PlanStep {
  id: string;
  description: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: StepStatus;
  result?: unknown;
  error?: string;
  attempt: number;
}

export interface ExecutionPlan {
  steps: PlanStep[];
  summary: string;
}

export interface PlanCallbacks {
  onPlan?: (plan: ExecutionPlan) => void;
  onStepStart?: (step: PlanStep) => void;
  onStepComplete?: (step: PlanStep) => void;
  onStepRetry?: (step: PlanStep, attempt: number, error: string) => void;
  onStepError?: (step: PlanStep, error: string) => void;
  onComplete?: (results: PlanStep[]) => void;
}

// ─── Retry delays: 500ms, 1s, 2s ──────────────────────────────────────────────

const RETRY_DELAYS = [500, 1_000, 2_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Auto-fix common parameter issues ─────────────────────────────────────────
// The LLM sometimes returns stringified JSON, weird casing, etc.

function autoFixArgs(raw: unknown): Record<string, unknown> {
  let args = raw;

  // Attempt to parse stringified JSON
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      // Not JSON – treat the string as a simple payload
      return { value: args };
    }
  }

  if (typeof args !== 'object' || args === null) {
    return { value: args };
  }

  const fixed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();

      // Normalise boolean-ish strings
      if (upper === 'TRUE') {
        fixed[key] = true;
      } else if (upper === 'FALSE') {
        fixed[key] = false;
      } else {
        fixed[key] = value;
      }
    } else {
      fixed[key] = value;
    }
  }

  return fixed;
}

// ─── Execute a single step with up to 3 retries ───────────────────────────────

async function executeStep(
  step: PlanStep,
  userId: string,
  callbacks: PlanCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  step.status = 'running';
  callbacks.onStepStart?.(step);

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    step.attempt = attempt;

    try {
      const args = autoFixArgs(step.toolArgs);
      const result = await executeToolCall(step.toolName, args, userId);

      if (result.success) {
        step.status = 'completed';
        step.result = result.data;
        step.error = undefined;
        callbacks.onStepComplete?.(step);
        return;
      }

      // Tool executed but signalled failure
      throw new Error(result.error || 'Tool returned failure');
    } catch (error: unknown) {
      if (signal?.aborted) throw error;

      const message = error instanceof Error ? error.message : 'An unknown error occurred';

      if (attempt < 3) {
        step.status = 'retrying';
        step.error = message;
        callbacks.onStepRetry?.(step, attempt, message);
        await sleep(RETRY_DELAYS[attempt - 1]);
      } else {
        step.status = 'failed';
        step.error = message;
        callbacks.onStepError?.(step, message);
      }
    }
  }
}

// ─── Execute a complete plan ──────────────────────────────────────────────────

export async function executePlan(
  plan: ExecutionPlan,
  userId: string,
  callbacks: PlanCallbacks = {},
  signal?: AbortSignal,
): Promise<PlanStep[]> {
  callbacks.onPlan?.(plan);

  for (const step of plan.steps) {
    if (signal?.aborted) break;
    await executeStep(step, userId, callbacks, signal);
  }

  callbacks.onComplete?.(plan.steps);
  return plan.steps;
}

// ─── Smart summary extraction ─────────────────────────────────────────────────

export function extractSummary(result: unknown, toolName: string): string {
  if (!result) return '';

  const data =
    typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : {};

  switch (toolName) {
    case 'get_dashboard': {
      const d = data as Record<string, number>;
      return `${d.projects ?? 0} projects, ${d.pending ?? 0} pending tasks`;
    }

    case 'search_projects': {
      const projects = data.projects as Array<Record<string, unknown>> | undefined;
      if (projects && projects.length > 0) {
        return `Found ${projects.length} project(s)`;
      }
      return 'No projects found';
    }

    case 'get_project': {
      const p = data as Record<string, unknown> | undefined;
      if (p?.name) return `Project: ${p.name}`;
      return '';
    }

    case 'get_tasks': {
      const tasks = Array.isArray(data) ? data : [];
      const pending = tasks.filter((t: Record<string, unknown>) => !t.completed).length;
      const completed = tasks.filter((t: Record<string, unknown>) => t.completed).length;
      return `${pending} pending, ${completed} completed`;
    }

    case 'get_scripts':
    case 'get_ideas':
    case 'get_personas':
    case 'get_transcriptions':
    case 'get_notes':
    case 'get_links':
    case 'get_api_keys':
    case 'get_integrations':
    case 'get_principles':
    case 'get_styles':
    case 'get_reminders':
    case 'get_habits': {
      const items = Array.isArray(data) ? data : [];
      return `${items.length} item(s) found`;
    }

    case 'get_persona': {
      const p = data as Record<string, unknown> | undefined;
      return p?.name ? `Persona: ${p.name}` : '';
    }

    case 'get_script': {
      const s = data as Record<string, unknown> | undefined;
      return s?.title ? `Script: ${s.title}` : '';
    }

    case 'get_focus_stats': {
      const f = data as Record<string, unknown> | undefined;
      return f ? `${f.sessions} sessions, ${f.totalPomodoros} pomodoros, ${f.totalMinutes} minutes focused` : '';
    }

    case 'create_project':
    case 'create_task':
    case 'create_note':
    case 'create_link':
    case 'create_persona_lesson':
    case 'create_persona_example':
    case 'create_idea':
    case 'create_persona':
    case 'create_habit':
    case 'create_reminder':
      return 'Created successfully';

    case 'update_project':
    case 'update_task':
    case 'update_idea':
    case 'update_persona':
    case 'update_script':
      return 'Updated successfully';

    case 'delete_project':
    case 'delete_task':
    case 'delete_note':
    case 'delete_link':
    case 'delete_script':
    case 'delete_reminder':
      return 'Deleted successfully';

    case 'log_habit': {
      const l = data as Record<string, unknown> | undefined;
      return l?.habitId ? 'Habit logged for today' : 'Habit logged';
    }

    case 'promote_idea':
      return 'Idea promoted';

    case 'archive_idea':
      return 'Idea archived';

    case 'save_memory': {
      const m = data as Record<string, unknown> | undefined;
      return m?.key ? `Memory saved: ${m.key}` : 'Memory saved';
    }

    case 'list_memories': {
      const items = Array.isArray(data) ? data : [];
      return `${items.length} memory item(s) found`;
    }

    case 'generate_script': {
      const s = data as Record<string, unknown> | undefined;
      return s?.title ? `Script: ${s.title}` : 'Script generated';
    }

    default:
      return '';
  }
}

