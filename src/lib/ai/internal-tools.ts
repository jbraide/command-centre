import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateCompletion, buildScriptPrompt } from '@/lib/ai';
import { toolRegistry, type ToolDefinition } from '@/lib/ai/tool-registry';

// ─── Helper: build a partial select that excludes sensitive / circular fields ──

const userSafeSelect = { id: true, email: true, name: true } as const;

// ─── 1. get_ideas ──────────────────────────────────────────────────────────────

const getIdeasSchema = z.object({
  status: z.string().optional(),
  tag: z.string().optional(),
});

async function getIdeasHandler(args: unknown, userId: string) {
  const params = getIdeasSchema.parse(args);

  const where: Record<string, unknown> = { userId };
  if (params.status) where.status = params.status;
  if (params.tag) where.tags = { contains: params.tag };

  const ideas = await prisma.idea.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      rawNotes: true,
      tags: true,
      status: true,
      linkedProjectId: true,
      linkedScriptId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ideas.map((idea) => ({
    ...idea,
    tags: idea.tags ? JSON.parse(idea.tags) : [],
  }));
}

// ─── 2. get_personas ───────────────────────────────────────────────────────────

const getPersonasSchema = z.object({
  activeOnly: z.boolean().optional(),
});

async function getPersonasHandler(args: unknown, userId: string) {
  const params = getPersonasSchema.parse(args);

  const where: Record<string, unknown> = { userId };
  if (params.activeOnly) where.active = true;

  return prisma.creatorPersona.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      colorTag: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ─── 3. get_persona ────────────────────────────────────────────────────────────

const getPersonaSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
});

async function getPersonaHandler(args: unknown, userId: string) {
  const params = getPersonaSchema.parse(args);

  const persona = await prisma.creatorPersona.findUnique({
    where: { id: params.personaId },
    include: {
      examples: {
        select: {
          id: true,
          sourceType: true,
          content: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      lessons: {
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!persona) {
    return { error: `Persona with id "${params.personaId}" not found.` };
  }

  if (persona.userId !== userId) {
    return { error: 'Persona not found.' };
  }

  const { userId: _u, ...safePersona } = persona;
  return safePersona;
}

// ─── 4. get_principles ────────────────────────────────────────────────────────

const getPrinciplesSchema = z.object({});

async function getPrinciplesHandler(_args: unknown, userId: string) {
  return prisma.keyPrinciple.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
    },
  });
}

// ─── 5. get_styles ─────────────────────────────────────────────────────────────

const getStylesSchema = z.object({});

async function getStylesHandler(_args: unknown, userId: string) {
  return prisma.scriptStyle.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      guidelines: true,
      createdAt: true,
    },
  });
}

// ─── 6. get_scripts ────────────────────────────────────────────────────────────

const getScriptsSchema = z.object({
  personaId: z.string().optional(),
});

async function getScriptsHandler(args: unknown, userId: string) {
  const params = getScriptsSchema.parse(args);

  const where: Record<string, unknown> = { userId };
  if (params.personaId) where.personaId = params.personaId;

  return prisma.script.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      styleId: true,
      projectId: true,
      personaId: true,
      ideaId: true,
      createdAt: true,
      updatedAt: true,
      style: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      persona: { select: { id: true, name: true, colorTag: true } },
      idea: { select: { id: true, title: true } },
    },
  });
}

// ─── 7. get_transcriptions ─────────────────────────────────────────────────────

const getTranscriptionsSchema = z.object({
  limit: z.number().int().positive().optional().default(20),
  search: z.string().optional(),
});

async function getTranscriptionsHandler(args: unknown, userId: string) {
  const params = getTranscriptionsSchema.parse(args);

  const where: Record<string, unknown> = { userId };
  if (params.search) where.text = { contains: params.search };

  return prisma.savedTranscription.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    select: {
      id: true,
      title: true,
      url: true,
      text: true,
      language: true,
      duration: true,
      createdAt: true,
    },
  });
}

// ─── 8. generate_script ────────────────────────────────────────────────────────

const generateScriptSchema = z.object({
  topic: z.string().min(1, 'topic is required'),
  personaId: z.string().optional(),
  styleId: z.string().optional(),
  constraints: z.string().optional(),
});

async function generateScriptHandler(args: unknown, userId: string) {
  const params = generateScriptSchema.parse(args);

  let personaLessons: string | undefined;
  let personaExamples: string | undefined;
  let styleGuidelines: string | undefined;

  // Fetch persona data if provided
  if (params.personaId) {
    const persona = await prisma.creatorPersona.findUnique({
      where: { id: params.personaId, userId },
      include: { examples: true, lessons: true },
    });

    if (!persona) {
      return { error: `Persona with id "${params.personaId}" not found.` };
    }

    if (persona.lessons.length > 0) {
      personaLessons = persona.lessons
        .map((l) => `[${l.title}] ${l.content}`)
        .join('\n');
    }

    if (persona.examples.length > 0) {
      personaExamples = persona.examples
        .map((e) => {
          let block = e.content;
          if (e.note) block += `\n/* ${e.note} */`;
          return block;
        })
        .join('\n\n---\n\n');
    }
  }

  // Fetch script style guidelines if provided
  if (params.styleId) {
    const style = await prisma.scriptStyle.findUnique({
      where: { id: params.styleId },
    });

    if (style?.guidelines) {
      styleGuidelines = style.guidelines;
    }
  }

  // Build prompt and generate
  const systemPrompt = buildScriptPrompt({
    topic: params.topic,
    personaLessons,
    personaExamples,
    scriptStyle: styleGuidelines,
    constraints: params.constraints,
  });

  const content = await generateCompletion({
    userId,
    systemPrompt,
    userPrompt: `Topic: ${params.topic}\n\nWrite the script.`,
    temperature: 0.7,
    maxTokens: 2048,
  });

  // Save the generated script
  const title = `Generated Script ${new Date().toLocaleDateString()}`;

  const script = await prisma.script.create({
    data: {
      userId,
      title,
      content,
      styleId: params.styleId ?? null,
      personaId: params.personaId ?? null,
    },
    select: {
      id: true,
      title: true,
      content: true,
      styleId: true,
      personaId: true,
      projectId: true,
      ideaId: true,
      createdAt: true,
      updatedAt: true,
      style: { select: { id: true, name: true } },
      persona: { select: { id: true, name: true, colorTag: true } },
    },
  });

  return { content, script };
}

// ────────────────────────────────────────────────────────────────
// 9. search_projects
// ────────────────────────────────────────────────────────────────

const searchProjectsSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
});

async function searchProjectsHandler(args: unknown, userId: string) {
  const params = searchProjectsSchema.parse(args);

  const where: Record<string, unknown> = { userId };
  if (params.query) where.name = { contains: params.query };
  if (params.status) where.status = params.status;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { tasks: true } },
    },
  });

  return projects.map(({ _count, ...p }) => ({
    ...p,
    taskCount: _count.tasks,
  }));
}

// ────────────────────────────────────────────────────────────────
// 10. get_project
// ────────────────────────────────────────────────────────────────

const getProjectSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

async function getProjectHandler(args: unknown, userId: string) {
  const params = getProjectSchema.parse(args);

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      color: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      tasks: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          completed: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, content: true, createdAt: true },
      },
      links: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, url: true, title: true, createdAt: true },
      },
    },
  });

  if (!project || project.userId !== userId) {
    return { error: 'Project not found.' };
  }

  const { userId: _u, ...safeProject } = project;
  return safeProject;
}

// ────────────────────────────────────────────────────────────────
// 11. create_project
// ────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
});

async function createProjectHandler(args: unknown, userId: string) {
  const params = createProjectSchema.parse(args);

  const project = await prisma.project.create({
    data: {
      userId,
      name: params.name,
      description: params.description ?? null,
      color: params.color ?? undefined,
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return project;
}

// ────────────────────────────────────────────────────────────────
// 12. update_project
// ────────────────────────────────────────────────────────────────

const updateProjectSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  name: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  status: z.string().optional(),
});

async function updateProjectHandler(args: unknown, userId: string) {
  const params = updateProjectSchema.parse(args);

  // Verify ownership
  const existing = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!existing || existing.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  const project = await prisma.project.update({
    where: { id: params.projectId },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.color !== undefined && { color: params.color }),
      ...(params.status !== undefined && { status: params.status }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return project;
}

// ────────────────────────────────────────────────────────────────
// 13. delete_project
// ────────────────────────────────────────────────────────────────

const deleteProjectSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

async function deleteProjectHandler(args: unknown, userId: string) {
  const params = deleteProjectSchema.parse(args);

  // Verify ownership
  const existing = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!existing || existing.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  await prisma.project.delete({ where: { id: params.projectId } });

  return { success: true, deletedProjectId: params.projectId };
}

// ────────────────────────────────────────────────────────────────
// 14. get_tasks
// ────────────────────────────────────────────────────────────────

const getTasksSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  status: z.enum(['pending', 'completed']).optional(),
});

async function getTasksHandler(args: unknown, userId: string) {
  const params = getTasksSchema.parse(args);

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  const where: Record<string, unknown> = { projectId: params.projectId };
  if (params.status === 'pending') where.completed = false;
  if (params.status === 'completed') where.completed = true;

  return prisma.task.findMany({
    where,
    orderBy: [{ completed: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      completed: true,
      priority: true,
      dueDate: true,
      description: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 15. create_task
// ────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  title: z.string().min(1, 'title is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().optional(),
});

async function createTaskHandler(args: unknown, userId: string) {
  const params = createTaskSchema.parse(args);

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  const task = await prisma.task.create({
    data: {
      projectId: params.projectId,
      title: params.title,
      ...(params.priority !== undefined && { priority: params.priority }),
      ...(params.dueDate !== undefined && { dueDate: new Date(params.dueDate) }),
    },
    select: {
      id: true,
      title: true,
      completed: true,
      priority: true,
      dueDate: true,
      description: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return task;
}

// ────────────────────────────────────────────────────────────────
// 16. update_task
// ────────────────────────────────────────────────────────────────

const updateTaskSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  title: z.string().optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().optional(),
});

async function updateTaskHandler(args: unknown, userId: string) {
  const params = updateTaskSchema.parse(args);

  // Verify ownership via project
  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: { project: { select: { userId: true } } },
  });

  if (!task || task.project.userId !== userId) {
    return { error: `Task with id "${params.taskId}" not found.` };
  }

  const updated = await prisma.task.update({
    where: { id: params.taskId },
    data: {
      ...(params.title !== undefined && { title: params.title }),
      ...(params.completed !== undefined && { completed: params.completed }),
      ...(params.priority !== undefined && { priority: params.priority }),
      ...(params.dueDate !== undefined && { dueDate: new Date(params.dueDate) }),
    },
    select: {
      id: true,
      title: true,
      completed: true,
      priority: true,
      dueDate: true,
      description: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

// ────────────────────────────────────────────────────────────────
// 17. delete_task
// ────────────────────────────────────────────────────────────────

const deleteTaskSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
});

async function deleteTaskHandler(args: unknown, userId: string) {
  const params = deleteTaskSchema.parse(args);

  // Verify ownership via project
  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: { project: { select: { userId: true } } },
  });

  if (!task || task.project.userId !== userId) {
    return { error: `Task with id "${params.taskId}" not found.` };
  }

  await prisma.task.delete({ where: { id: params.taskId } });

  return { success: true, deletedTaskId: params.taskId };
}

// ────────────────────────────────────────────────────────────────
// 18. get_notes
// ────────────────────────────────────────────────────────────────

const getNotesSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

async function getNotesHandler(args: unknown, userId: string) {
  const params = getNotesSchema.parse(args);

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  return prisma.note.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 19. create_note
// ────────────────────────────────────────────────────────────────

const createNoteSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  content: z.string().min(1, 'content is required'),
});

async function createNoteHandler(args: unknown, userId: string) {
  const params = createNoteSchema.parse(args);

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  const note = await prisma.note.create({
    data: {
      projectId: params.projectId,
      content: params.content,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return note;
}

// ────────────────────────────────────────────────────────────────
// 20. delete_note
// ────────────────────────────────────────────────────────────────

const deleteNoteSchema = z.object({
  noteId: z.string().min(1, 'noteId is required'),
});

async function deleteNoteHandler(args: unknown, userId: string) {
  const params = deleteNoteSchema.parse(args);

  // Verify ownership via project
  const note = await prisma.note.findUnique({
    where: { id: params.noteId },
    select: { project: { select: { userId: true } } },
  });

  if (!note || note.project.userId !== userId) {
    return { error: `Note with id "${params.noteId}" not found.` };
  }

  await prisma.note.delete({ where: { id: params.noteId } });

  return { success: true, deletedNoteId: params.noteId };
}

// ────────────────────────────────────────────────────────────────
// 21. get_links
// ────────────────────────────────────────────────────────────────

const getLinksSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

async function getLinksHandler(args: unknown, userId: string) {
  const params = getLinksSchema.parse(args);

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  return prisma.projectLink.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      createdAt: true,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 22. create_link
// ────────────────────────────────────────────────────────────────

const createLinkSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  url: z.string().min(1, 'url is required'),
  title: z.string().optional(),
});

async function createLinkHandler(args: unknown, userId: string) {
  const params = createLinkSchema.parse(args);

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  const link = await prisma.projectLink.create({
    data: {
      projectId: params.projectId,
      url: params.url,
      title: params.title ?? null,
    },
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      createdAt: true,
    },
  });

  return link;
}

// ────────────────────────────────────────────────────────────────
// 23. delete_link
// ────────────────────────────────────────────────────────────────

const deleteLinkSchema = z.object({
  linkId: z.string().min(1, 'linkId is required'),
});

async function deleteLinkHandler(args: unknown, userId: string) {
  const params = deleteLinkSchema.parse(args);

  // Verify ownership via project
  const link = await prisma.projectLink.findUnique({
    where: { id: params.linkId },
    select: { project: { select: { userId: true } } },
  });

  if (!link || link.project.userId !== userId) {
    return { error: `Link with id "${params.linkId}" not found.` };
  }

  await prisma.projectLink.delete({ where: { id: params.linkId } });

  return { success: true, deletedLinkId: params.linkId };
}

// ────────────────────────────────────────────────────────────────
// 24. promote_idea
// ────────────────────────────────────────────────────────────────

const promoteIdeaSchema = z.object({
  ideaId: z.string().min(1, 'ideaId is required'),
  projectId: z.string().min(1, 'projectId is required'),
});

async function promoteIdeaHandler(args: unknown, userId: string) {
  const params = promoteIdeaSchema.parse(args);

  // Verify idea ownership
  const idea = await prisma.idea.findUnique({
    where: { id: params.ideaId },
    select: { userId: true },
  });

  if (!idea || idea.userId !== userId) {
    return { error: `Idea with id "${params.ideaId}" not found.` };
  }

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== userId) {
    return { error: `Project with id "${params.projectId}" not found.` };
  }

  const updated = await prisma.idea.update({
    where: { id: params.ideaId },
    data: {
      status: 'promoted',
      linkedProjectId: params.projectId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      linkedProjectId: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...updated,
    tags: updated.tags ? JSON.parse(updated.tags) : [],
  };
}

// ────────────────────────────────────────────────────────────────
// 25. archive_idea
// ────────────────────────────────────────────────────────────────

const archiveIdeaSchema = z.object({
  ideaId: z.string().min(1, 'ideaId is required'),
});

async function archiveIdeaHandler(args: unknown, userId: string) {
  const params = archiveIdeaSchema.parse(args);

  // Verify ownership
  const idea = await prisma.idea.findUnique({
    where: { id: params.ideaId },
    select: { userId: true },
  });

  if (!idea || idea.userId !== userId) {
    return { error: `Idea with id "${params.ideaId}" not found.` };
  }

  const updated = await prisma.idea.update({
    where: { id: params.ideaId },
    data: { status: 'archived' },
    select: {
      id: true,
      title: true,
      status: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...updated,
    tags: updated.tags ? JSON.parse(updated.tags) : [],
  };
}

// ────────────────────────────────────────────────────────────────
// 26. create_persona_lesson
// ────────────────────────────────────────────────────────────────

const createPersonaLessonSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
});

async function createPersonaLessonHandler(args: unknown, userId: string) {
  const params = createPersonaLessonSchema.parse(args);

  // Verify persona ownership
  const persona = await prisma.creatorPersona.findUnique({
    where: { id: params.personaId },
    select: { userId: true },
  });

  if (!persona || persona.userId !== userId) {
    return { error: `Persona with id "${params.personaId}" not found.` };
  }

  const lesson = await prisma.personaLesson.create({
    data: {
      personaId: params.personaId,
      title: params.title,
      content: params.content,
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
    },
  });

  return lesson;
}

// ────────────────────────────────────────────────────────────────
// 27. create_persona_example
// ────────────────────────────────────────────────────────────────

const createPersonaExampleSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  content: z.string().min(1, 'content is required'),
  note: z.string().optional(),
  sourceType: z.string().optional(),
});

async function createPersonaExampleHandler(args: unknown, userId: string) {
  const params = createPersonaExampleSchema.parse(args);

  // Verify persona ownership
  const persona = await prisma.creatorPersona.findUnique({
    where: { id: params.personaId },
    select: { userId: true },
  });

  if (!persona || persona.userId !== userId) {
    return { error: `Persona with id "${params.personaId}" not found.` };
  }

  const example = await prisma.personaExample.create({
    data: {
      personaId: params.personaId,
      content: params.content,
      note: params.note ?? null,
      sourceType: params.sourceType ?? 'manual',
    },
    select: {
      id: true,
      content: true,
      note: true,
      sourceType: true,
      createdAt: true,
    },
  });

  return example;
}

// ────────────────────────────────────────────────────────────────
// 28. get_api_keys
// ────────────────────────────────────────────────────────────────

const getApiKeysSchema = z.object({});

async function getApiKeysHandler(_args: unknown, userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 29. get_integrations
// ────────────────────────────────────────────────────────────────

const getIntegrationsSchema = z.object({});

async function getIntegrationsHandler(_args: unknown, userId: string) {
  return prisma.serviceIntegration.findMany({
    where: { userId },
    orderBy: { service: 'asc' },
    select: {
      id: true,
      service: true,
      label: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 30. get_dashboard
// ────────────────────────────────────────────────────────────────

const getDashboardSchema = z.object({});

async function getDashboardHandler(_args: unknown, userId: string) {
  const [projects, tasks, ideas, transcriptions, scripts] = await Promise.all([
    prisma.project.count({ where: { userId } }),
    prisma.task.count({ where: { project: { userId } } }),
    prisma.idea.count({ where: { userId } }),
    prisma.savedTranscription.count({ where: { userId } }),
    prisma.script.count({ where: { userId } }),
  ]);

  const pendingTasks = await prisma.task.count({
    where: { project: { userId }, completed: false },
  });

  const completedTasks = await prisma.task.count({
    where: { project: { userId }, completed: true },
  });

  return {
    projects,
    tasks: { total: tasks, pending: pendingTasks, completed: completedTasks },
    ideas,
    transcriptions,
    scripts,
  };
}

// ────────────────────────────────────────────────────────────────
// 31. save_memory
// ────────────────────────────────────────────────────────────────

const saveMemorySchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  category: z.enum(['persona', 'business', 'content', 'general']).optional(),
});

async function saveMemoryHandler(args: unknown, userId: string) {
  const params = saveMemorySchema.parse(args);

  const memory = await prisma.memory.upsert({
    where: { userId_key: { userId, key: params.key } },
    update: { value: params.value, category: params.category ?? null },
    create: {
      userId,
      key: params.key,
      value: params.value,
      category: params.category ?? null,
    },
  });

  return memory;
}

// ────────────────────────────────────────────────────────────────
// 32. list_memories
// ────────────────────────────────────────────────────────────────

const listMemoriesSchema = z.object({
  category: z.enum(['persona', 'business', 'content', 'general']).optional(),
});

async function listMemoriesHandler(args: unknown, userId: string) {
  const params = listMemoriesSchema.parse(args);

  const where: Record<string, unknown> = { userId };
  if (params.category) where.category = params.category;

  const memories = await prisma.memory.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return memories;
}

// ─── 33. create_idea ─────────────────────────────────────────────────────────

const createIdeaSchema = z.object({
  title: z.string().min(1, 'title is required'),
  rawNotes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

async function createIdeaHandler(args: unknown, userId: string) {
  const params = createIdeaSchema.parse(args);
  const idea = await prisma.idea.create({
    data: {
      userId,
      title: params.title,
      rawNotes: params.rawNotes ?? null,
      tags: params.tags ? JSON.stringify(params.tags) : null,
      status: 'raw',
    },
    select: { id: true, title: true, rawNotes: true, tags: true, status: true, createdAt: true },
  });
  return { ...idea, tags: idea.tags ? JSON.parse(idea.tags) : [] };
}

// ─── 34. update_idea ─────────────────────────────────────────────────────────

const updateIdeaSchema = z.object({
  ideaId: z.string().min(1),
  title: z.string().optional(),
  rawNotes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['raw', 'promoted', 'archived']).optional(),
});

async function updateIdeaHandler(args: unknown, userId: string) {
  const params = updateIdeaSchema.parse(args);
  const existing = await prisma.idea.findUnique({ where: { id: params.ideaId }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return { error: `Idea "${params.ideaId}" not found.` };
  const updated = await prisma.idea.update({
    where: { id: params.ideaId },
    data: {
      ...(params.title !== undefined && { title: params.title }),
      ...(params.rawNotes !== undefined && { rawNotes: params.rawNotes }),
      ...(params.tags !== undefined && { tags: JSON.stringify(params.tags) }),
      ...(params.status !== undefined && { status: params.status }),
    },
    select: { id: true, title: true, rawNotes: true, tags: true, status: true, updatedAt: true },
  });
  return { ...updated, tags: updated.tags ? JSON.parse(updated.tags) : [] };
}

// ─── 35. get_reminders ────────────────────────────────────────────────────────

const getRemindersSchema = z.object({
  includeFired: z.boolean().optional().default(false),
});

async function getRemindersHandler(args: unknown, userId: string) {
  const params = getRemindersSchema.parse(args);
  return prisma.reminder.findMany({
    where: { userId, ...(params.includeFired ? {} : { fired: false }) },
    orderBy: { triggerAt: 'asc' },
    select: { id: true, title: true, note: true, triggerAt: true, fired: true, taskId: true, ideaId: true, createdAt: true },
  });
}

// ─── 36. create_reminder ──────────────────────────────────────────────────────

const createReminderSchema = z.object({
  title: z.string().min(1, 'title is required'),
  triggerAt: z.string().min(1, 'triggerAt ISO date is required'),
  note: z.string().optional(),
  taskId: z.string().optional(),
});

async function createReminderHandler(args: unknown, userId: string) {
  const params = createReminderSchema.parse(args);
  return prisma.reminder.create({
    data: {
      userId,
      title: params.title,
      triggerAt: new Date(params.triggerAt),
      note: params.note ?? null,
      taskId: params.taskId ?? null,
    },
    select: { id: true, title: true, note: true, triggerAt: true, fired: true, createdAt: true },
  });
}

// ─── 37. delete_reminder ──────────────────────────────────────────────────────

const deleteReminderSchema = z.object({ reminderId: z.string().min(1) });

async function deleteReminderHandler(args: unknown, userId: string) {
  const params = deleteReminderSchema.parse(args);
  const existing = await prisma.reminder.findUnique({ where: { id: params.reminderId }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return { error: `Reminder "${params.reminderId}" not found.` };
  await prisma.reminder.delete({ where: { id: params.reminderId } });
  return { success: true, deletedReminderId: params.reminderId };
}

// ─── 38. get_habits ───────────────────────────────────────────────────────────

const getHabitsSchema = z.object({ activeOnly: z.boolean().optional().default(true) });

async function getHabitsHandler(args: unknown, userId: string) {
  const params = getHabitsSchema.parse(args);
  const habits = await prisma.habit.findMany({
    where: { userId, ...(params.activeOnly ? { active: true } : {}) },
    orderBy: { createdAt: 'asc' },
    include: {
      logs: {
        where: { date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { date: true, completed: true, note: true },
        orderBy: { date: 'desc' },
      },
    },
  });
  return habits.map(({ logs, ...h }) => ({
    ...h,
    recentLogs: logs,
    streak: logs.filter((l) => l.completed).length,
  }));
}

// ─── 39. create_habit ─────────────────────────────────────────────────────────

const createHabitSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'weekdays']).optional().default('daily'),
  color: z.string().optional(),
});

async function createHabitHandler(args: unknown, userId: string) {
  const params = createHabitSchema.parse(args);
  return prisma.habit.create({
    data: {
      userId,
      name: params.name,
      description: params.description ?? null,
      frequency: params.frequency,
      color: params.color ?? '#7fd858',
    },
    select: { id: true, name: true, description: true, frequency: true, color: true, active: true, createdAt: true },
  });
}

// ─── 40. log_habit ────────────────────────────────────────────────────────────

const logHabitSchema = z.object({
  habitId: z.string().min(1, 'habitId is required'),
  date: z.string().optional(), // ISO date, defaults to today
  note: z.string().optional(),
});

async function logHabitHandler(args: unknown, userId: string) {
  const params = logHabitSchema.parse(args);
  const habit = await prisma.habit.findUnique({ where: { id: params.habitId }, select: { userId: true } });
  if (!habit || habit.userId !== userId) return { error: `Habit "${params.habitId}" not found.` };

  const date = params.date ? new Date(params.date) : new Date();
  date.setUTCHours(0, 0, 0, 0);

  const log = await prisma.habitLog.upsert({
    where: { habitId_date: { habitId: params.habitId, date } },
    update: { completed: true, note: params.note ?? null },
    create: { habitId: params.habitId, date, completed: true, note: params.note ?? null },
    select: { id: true, habitId: true, date: true, completed: true, note: true, createdAt: true },
  });
  return log;
}

// ─── 41. get_focus_stats ──────────────────────────────────────────────────────

const getFocusStatsSchema = z.object({
  days: z.number().int().positive().optional().default(7),
});

async function getFocusStatsHandler(args: unknown, userId: string) {
  const params = getFocusStatsSchema.parse(args);
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.focusSession.findMany({
    where: { userId, startedAt: { gte: since } },
    select: { id: true, duration: true, completedPomodoros: true, startedAt: true, endedAt: true, taskId: true },
    orderBy: { startedAt: 'desc' },
  });
  const totalPomodoros = sessions.reduce((s, x) => s + x.completedPomodoros, 0);
  const totalMinutes = sessions.reduce((s, x) => s + x.duration * x.completedPomodoros, 0);
  return { sessions: sessions.length, totalPomodoros, totalMinutes, recentSessions: sessions.slice(0, 10) };
}

// ─── 42. get_script ───────────────────────────────────────────────────────────

const getScriptSchema = z.object({ scriptId: z.string().min(1, 'scriptId is required') });

async function getScriptHandler(args: unknown, userId: string) {
  const params = getScriptSchema.parse(args);
  const script = await prisma.script.findUnique({
    where: { id: params.scriptId },
    select: {
      id: true, userId: true, title: true, content: true, createdAt: true, updatedAt: true,
      style: { select: { id: true, name: true } },
      persona: { select: { id: true, name: true, colorTag: true } },
      idea: { select: { id: true, title: true } },
    },
  });
  if (!script || script.userId !== userId) return { error: `Script "${params.scriptId}" not found.` };
  const { userId: _u, ...safe } = script;
  return safe;
}

// ─── 43. update_script ────────────────────────────────────────────────────────

const updateScriptSchema = z.object({
  scriptId: z.string().min(1, 'scriptId is required'),
  title: z.string().optional(),
  content: z.string().optional(),
});

async function updateScriptHandler(args: unknown, userId: string) {
  const params = updateScriptSchema.parse(args);
  const existing = await prisma.script.findUnique({ where: { id: params.scriptId }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return { error: `Script "${params.scriptId}" not found.` };
  return prisma.script.update({
    where: { id: params.scriptId },
    data: {
      ...(params.title !== undefined && { title: params.title }),
      ...(params.content !== undefined && { content: params.content }),
    },
    select: { id: true, title: true, content: true, updatedAt: true },
  });
}

// ─── 44. delete_script ────────────────────────────────────────────────────────

const deleteScriptSchema = z.object({ scriptId: z.string().min(1, 'scriptId is required') });

async function deleteScriptHandler(args: unknown, userId: string) {
  const params = deleteScriptSchema.parse(args);
  const existing = await prisma.script.findUnique({ where: { id: params.scriptId }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return { error: `Script "${params.scriptId}" not found.` };
  await prisma.script.delete({ where: { id: params.scriptId } });
  return { success: true, deletedScriptId: params.scriptId };
}

// ─── 45. create_persona ───────────────────────────────────────────────────────

const createPersonaSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  colorTag: z.string().optional(),
});

async function createPersonaHandler(args: unknown, userId: string) {
  const params = createPersonaSchema.parse(args);
  return prisma.creatorPersona.create({
    data: {
      userId,
      name: params.name,
      description: params.description ?? null,
      colorTag: params.colorTag ?? '#7fd858',
    },
    select: { id: true, name: true, description: true, colorTag: true, active: true, createdAt: true },
  });
}

// ─── 46. update_persona ───────────────────────────────────────────────────────

const updatePersonaSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  name: z.string().optional(),
  description: z.string().optional(),
  colorTag: z.string().optional(),
  active: z.boolean().optional(),
});

async function updatePersonaHandler(args: unknown, userId: string) {
  const params = updatePersonaSchema.parse(args);
  const existing = await prisma.creatorPersona.findUnique({ where: { id: params.personaId }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return { error: `Persona "${params.personaId}" not found.` };
  return prisma.creatorPersona.update({
    where: { id: params.personaId },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.colorTag !== undefined && { colorTag: params.colorTag }),
      ...(params.active !== undefined && { active: params.active }),
    },
    select: { id: true, name: true, description: true, colorTag: true, active: true, updatedAt: true },
  });
}

// ─── Build ToolDefinitions ─────────────────────────────────────────────────────

const tools: ToolDefinition[] = [
  {
    name: 'get_ideas',
    description:
      'List ideas from the Idea Hub. Optionally filter by status (raw, promoted, archived) or tag.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by idea status: raw, promoted, or archived',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag (partial match)',
        },
      },
    },
    zodSchema: getIdeasSchema,
    handler: getIdeasHandler,
  },
  {
    name: 'create_idea',
    description: 'Create a new idea in the Idea Hub.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The idea title' },
        rawNotes: { type: 'string', description: 'Optional raw notes or details' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional array of tag strings' },
      },
      required: ['title'],
    },
    zodSchema: createIdeaSchema,
    handler: createIdeaHandler,
  },
  {
    name: 'update_idea',
    description: 'Update an idea\'s title, notes, tags, or status.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        ideaId: { type: 'string', description: 'The ID of the idea to update' },
        title: { type: 'string', description: 'New title' },
        rawNotes: { type: 'string', description: 'New notes' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags array' },
        status: { type: 'string', enum: ['raw', 'promoted', 'archived'], description: 'New status' },
      },
      required: ['ideaId'],
    },
    zodSchema: updateIdeaSchema,
    handler: updateIdeaHandler,
  },
  {
    name: 'get_personas',
    description:
      'List creator personas. Optionally show only active personas.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        activeOnly: {
          type: 'boolean',
          description: 'If true, only return active personas',
        },
      },
    },
    zodSchema: getPersonasSchema,
    handler: getPersonasHandler,
  },
  {
    name: 'get_persona',
    description:
      'Get a single creator persona with its examples and lessons.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        personaId: {
          type: 'string',
          description: 'The ID of the persona to retrieve',
        },
      },
      required: ['personaId'],
    },
    zodSchema: getPersonaSchema,
    handler: getPersonaHandler,
  },
  {
    name: 'create_persona',
    description: 'Create a new creator persona.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The persona name' },
        description: { type: 'string', description: 'Optional description of the persona' },
        colorTag: { type: 'string', description: 'Optional hex color tag (e.g. #7fd858)' },
      },
      required: ['name'],
    },
    zodSchema: createPersonaSchema,
    handler: createPersonaHandler,
  },
  {
    name: 'update_persona',
    description: 'Update a creator persona\'s name, description, color, or active status.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        personaId: { type: 'string', description: 'The ID of the persona to update' },
        name: { type: 'string', description: 'New name' },
        description: { type: 'string', description: 'New description' },
        colorTag: { type: 'string', description: 'New hex color tag' },
        active: { type: 'boolean', description: 'Set active/inactive' },
      },
      required: ['personaId'],
    },
    zodSchema: updatePersonaSchema,
    handler: updatePersonaHandler,
  },
  {
    name: 'get_principles',
    description: 'List all key principles for the user.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    zodSchema: getPrinciplesSchema,
    handler: getPrinciplesHandler,
  },
  {
    name: 'get_styles',
    description: 'List all script styles for the user.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    zodSchema: getStylesSchema,
    handler: getStylesHandler,
  },
  {
    name: 'get_scripts',
    description:
      'List saved scripts. Optionally filter by persona.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        personaId: {
          type: 'string',
          description: 'Filter scripts by persona ID',
        },
      },
    },
    zodSchema: getScriptsSchema,
    handler: getScriptsHandler,
  },
  {
    name: 'get_script',
    description: 'Get a single script by ID, including its full content.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        scriptId: { type: 'string', description: 'The ID of the script to retrieve' },
      },
      required: ['scriptId'],
    },
    zodSchema: getScriptSchema,
    handler: getScriptHandler,
  },
  {
    name: 'update_script',
    description: 'Update a script\'s title or content.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        scriptId: { type: 'string', description: 'The ID of the script to update' },
        title: { type: 'string', description: 'New title' },
        content: { type: 'string', description: 'New content' },
      },
      required: ['scriptId'],
    },
    zodSchema: updateScriptSchema,
    handler: updateScriptHandler,
  },
  {
    name: 'delete_script',
    description: 'Delete a script permanently.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        scriptId: { type: 'string', description: 'The ID of the script to delete' },
      },
      required: ['scriptId'],
    },
    zodSchema: deleteScriptSchema,
    handler: deleteScriptHandler,
  },
  {
    name: 'get_transcriptions',
    description:
      'List saved transcriptions. Optionally limit results or search by text content.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of transcriptions to return (default 20)',
        },
        search: {
          type: 'string',
          description: 'Search term to filter transcriptions by text content',
        },
      },
    },
    zodSchema: getTranscriptionsSchema,
    handler: getTranscriptionsHandler,
  },
  {
    name: 'generate_script',
    description:
      'Generate a script draft using AI. Provide a topic and optionally specify a persona, style, or constraints. The AI will use Kallaway\'s lessons and examples if a personaId is given.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The topic or subject for the script',
        },
        personaId: {
          type: 'string',
          description: 'Optional creator persona ID to influence voice and style',
        },
        styleId: {
          type: 'string',
          description: 'Optional script style ID for structure template',
        },
        constraints: {
          type: 'string',
          description: 'Optional constraints or requirements for the script',
        },
      },
      required: ['topic'],
    },
    zodSchema: generateScriptSchema,
    handler: generateScriptHandler,
  },
  {
    name: 'get_reminders',
    description: 'List upcoming reminders. By default shows only unfired reminders.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        includeFired: { type: 'boolean', description: 'If true, also include already-fired reminders' },
      },
    },
    zodSchema: getRemindersSchema,
    handler: getRemindersHandler,
  },
  {
    name: 'create_reminder',
    description: 'Create a new reminder with a title, trigger date/time, and optional note.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The reminder title' },
        triggerAt: { type: 'string', description: 'ISO date-time string for when the reminder should fire (e.g. 2026-08-01T09:00:00Z)' },
        note: { type: 'string', description: 'Optional note or details' },
        taskId: { type: 'string', description: 'Optional task ID to link this reminder to' },
      },
      required: ['title', 'triggerAt'],
    },
    zodSchema: createReminderSchema,
    handler: createReminderHandler,
  },
  {
    name: 'delete_reminder',
    description: 'Delete a reminder by ID.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        reminderId: { type: 'string', description: 'The ID of the reminder to delete' },
      },
      required: ['reminderId'],
    },
    zodSchema: deleteReminderSchema,
    handler: deleteReminderHandler,
  },
  {
    name: 'get_habits',
    description: 'List habits with their last 7 days of log data and streak count.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'If true (default), only return active habits' },
      },
    },
    zodSchema: getHabitsSchema,
    handler: getHabitsHandler,
  },
  {
    name: 'create_habit',
    description: 'Create a new habit to track.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The habit name' },
        description: { type: 'string', description: 'Optional description' },
        frequency: { type: 'string', enum: ['daily', 'weekly', 'weekdays'], description: 'How often the habit should be done (default: daily)' },
        color: { type: 'string', description: 'Optional hex color tag' },
      },
      required: ['name'],
    },
    zodSchema: createHabitSchema,
    handler: createHabitHandler,
  },
  {
    name: 'log_habit',
    description: 'Mark a habit as completed for today (or a specific date).',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        habitId: { type: 'string', description: 'The ID of the habit to log' },
        date: { type: 'string', description: 'Optional ISO date string (defaults to today)' },
        note: { type: 'string', description: 'Optional note for this log entry' },
      },
      required: ['habitId'],
    },
    zodSchema: logHabitSchema,
    handler: logHabitHandler,
  },
  {
    name: 'get_focus_stats',
    description: 'Get focus/Pomodoro session statistics for the last N days (default 7). Returns total sessions, pomodoros, and total focused minutes.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of past days to include (default 7)' },
      },
    },
    zodSchema: getFocusStatsSchema,
    handler: getFocusStatsHandler,
  },
  {
    name: 'search_projects',
    description:
      'Search projects by name or status. Returns basic info with task counts.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to match against project name',
        },
        status: {
          type: 'string',
          description: 'Filter by project status (ACTIVE, ARCHIVED, COMPLETED)',
        },
      },
    },
    zodSchema: searchProjectsSchema,
    handler: searchProjectsHandler,
  },
  {
    name: 'get_project',
    description:
      'Get a single project with all its tasks, notes, and links.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to retrieve',
        },
      },
      required: ['projectId'],
    },
    zodSchema: getProjectSchema,
    handler: getProjectHandler,
  },
  {
    name: 'create_project',
    description:
      'Create a new project. Returns the created project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the project',
        },
        description: {
          type: 'string',
          description: 'Optional description of the project',
        },
        color: {
          type: 'string',
          description: 'Optional hex color for the project (e.g. #7fd858)',
        },
      },
      required: ['name'],
    },
    zodSchema: createProjectSchema,
    handler: createProjectHandler,
  },
  {
    name: 'update_project',
    description:
      'Update a project\'s name, description, color, or status.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to update',
        },
        name: {
          type: 'string',
          description: 'New name for the project',
        },
        description: {
          type: 'string',
          description: 'New description for the project',
        },
        color: {
          type: 'string',
          description: 'New hex color for the project',
        },
        status: {
          type: 'string',
          description: 'New status (ACTIVE, ARCHIVED, COMPLETED)',
        },
      },
      required: ['projectId'],
    },
    zodSchema: updateProjectSchema,
    handler: updateProjectHandler,
  },
  {
    name: 'delete_project',
    description:
      'Delete a project and all its associated tasks, notes, and links.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to delete',
        },
      },
      required: ['projectId'],
    },
    zodSchema: deleteProjectSchema,
    handler: deleteProjectHandler,
  },
  {
    name: 'get_tasks',
    description:
      'Get tasks for a project, optionally filtered by status (pending or completed).',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get tasks for',
        },
        status: {
          type: 'string',
          enum: ['pending', 'completed'],
          description: 'Filter by status: pending or completed',
        },
      },
      required: ['projectId'],
    },
    zodSchema: getTasksSchema,
    handler: getTasksHandler,
  },
  {
    name: 'create_task',
    description:
      'Create a new task in a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to add the task to',
        },
        title: {
          type: 'string',
          description: 'The title of the task',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          description: 'Priority level (LOW, MEDIUM, HIGH)',
        },
        dueDate: {
          type: 'string',
          description: 'ISO date string for the due date',
        },
      },
      required: ['projectId', 'title'],
    },
    zodSchema: createTaskSchema,
    handler: createTaskHandler,
  },
  {
    name: 'update_task',
    description:
      'Update a task\'s title, completion status, priority, or due date.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to update',
        },
        title: {
          type: 'string',
          description: 'New title for the task',
        },
        completed: {
          type: 'boolean',
          description: 'Mark task as completed or not',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          description: 'New priority level',
        },
        dueDate: {
          type: 'string',
          description: 'ISO date string for the new due date',
        },
      },
      required: ['taskId'],
    },
    zodSchema: updateTaskSchema,
    handler: updateTaskHandler,
  },
  {
    name: 'delete_task',
    description:
      'Delete a task from a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to delete',
        },
      },
      required: ['taskId'],
    },
    zodSchema: deleteTaskSchema,
    handler: deleteTaskHandler,
  },
  {
    name: 'get_notes',
    description:
      'Get all notes for a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get notes for',
        },
      },
      required: ['projectId'],
    },
    zodSchema: getNotesSchema,
    handler: getNotesHandler,
  },
  {
    name: 'create_note',
    description:
      'Create a new note in a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to add the note to',
        },
        content: {
          type: 'string',
          description: 'The content of the note',
        },
      },
      required: ['projectId', 'content'],
    },
    zodSchema: createNoteSchema,
    handler: createNoteHandler,
  },
  {
    name: 'delete_note',
    description:
      'Delete a note from a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The ID of the note to delete',
        },
      },
      required: ['noteId'],
    },
    zodSchema: deleteNoteSchema,
    handler: deleteNoteHandler,
  },
  {
    name: 'get_links',
    description:
      'Get all links for a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get links for',
        },
      },
      required: ['projectId'],
    },
    zodSchema: getLinksSchema,
    handler: getLinksHandler,
  },
  {
    name: 'create_link',
    description:
      'Create a new link in a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to add the link to',
        },
        url: {
          type: 'string',
          description: 'The URL of the link',
        },
        title: {
          type: 'string',
          description: 'Optional title for the link',
        },
      },
      required: ['projectId', 'url'],
    },
    zodSchema: createLinkSchema,
    handler: createLinkHandler,
  },
  {
    name: 'delete_link',
    description:
      'Delete a link from a project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        linkId: {
          type: 'string',
          description: 'The ID of the link to delete',
        },
      },
      required: ['linkId'],
    },
    zodSchema: deleteLinkSchema,
    handler: deleteLinkHandler,
  },
  {
    name: 'promote_idea',
    description:
      'Promote an idea to a project. Sets the idea status to promoted and links it to the specified project.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        ideaId: {
          type: 'string',
          description: 'The ID of the idea to promote',
        },
        projectId: {
          type: 'string',
          description: 'The project ID to link the idea to',
        },
      },
      required: ['ideaId', 'projectId'],
    },
    zodSchema: promoteIdeaSchema,
    handler: promoteIdeaHandler,
  },
  {
    name: 'archive_idea',
    description:
      'Archive an idea. Sets the idea status to archived.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        ideaId: {
          type: 'string',
          description: 'The ID of the idea to archive',
        },
      },
      required: ['ideaId'],
    },
    zodSchema: archiveIdeaSchema,
    handler: archiveIdeaHandler,
  },
  {
    name: 'create_persona_lesson',
    description:
      'Add a lesson to a creator persona. Lessons define how the persona thinks or creates.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        personaId: {
          type: 'string',
          description: 'The ID of the persona',
        },
        title: {
          type: 'string',
          description: 'The lesson title',
        },
        content: {
          type: 'string',
          description: 'The lesson content',
        },
      },
      required: ['personaId', 'title', 'content'],
    },
    zodSchema: createPersonaLessonSchema,
    handler: createPersonaLessonHandler,
  },
  {
    name: 'create_persona_example',
    description:
      'Add an example to a creator persona. Examples show the persona\'s style through sample content.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        personaId: {
          type: 'string',
          description: 'The ID of the persona',
        },
        content: {
          type: 'string',
          description: 'The example content (writing sample)',
        },
        note: {
          type: 'string',
          description: 'Optional note explaining the example',
        },
        sourceType: {
          type: 'string',
          description: 'Source type: manual or transcription',
        },
      },
      required: ['personaId', 'content'],
    },
    zodSchema: createPersonaExampleSchema,
    handler: createPersonaExampleHandler,
  },
  {
    name: 'get_api_keys',
    description:
      'List API key names and descriptions. Does NOT return decrypted keys.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    zodSchema: getApiKeysSchema,
    handler: getApiKeysHandler,
  },
  {
    name: 'get_integrations',
    description:
      'List configured service integrations (e.g. YouTube, Twitter).',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    zodSchema: getIntegrationsSchema,
    handler: getIntegrationsHandler,
  },
  {
    name: 'get_dashboard',
    description:
      'Get summary counts for the dashboard: projects, tasks (pending/completed), ideas, transcriptions, and scripts.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    zodSchema: getDashboardSchema,
    handler: getDashboardHandler,
  },
  {
    name: 'save_memory',
    description:
      'Save a fact or piece of knowledge to long-term memory. Memories persist across conversations and are injected into the AI\'s system prompt on every chat. Use this to remember user preferences, business details, content guidelines, or any information the user wants the AI to retain permanently. Upserts by key (if the key already exists, the value is updated).',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Unique key for the memory (e.g. "brand_voice", "business_name")',
        },
        value: {
          type: 'string',
          description: 'The fact or information to remember',
        },
        category: {
          type: 'string',
          enum: ['persona', 'business', 'content', 'general'],
          description: 'Optional category: persona, business, content, or general',
        },
      },
      required: ['key', 'value'],
    },
    zodSchema: saveMemorySchema,
    handler: saveMemoryHandler,
  },
  {
    name: 'list_memories',
    description:
      'List all saved memories for the user. Optionally filter by category (persona, business, content, general). Returns key-value pairs the AI has learned across conversations.',
    category: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['persona', 'business', 'content', 'general'],
          description: 'Optional filter by category',
        },
      },
    },
    zodSchema: listMemoriesSchema,
    handler: listMemoriesHandler,
  },
];

// ─── Register all tools with the global registry ─────────────────────────────

for (const tool of tools) {
  toolRegistry.register(tool);
}

