import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/import — import data into the authenticated user's account
//
// Accepts JSON matching the export format. Only imports the sections listed below;
// passwords, apiKeys, and serviceIntegrations are excluded because they contain
// user-specific encrypted data that cannot be transferred between accounts.
//
// Body shape:
//   projects?: Array<{ name, description?, color?, status?,
//     tasks?: Array<{ title, description?, dueDate?, priority?, completed? }>,
//     notes?: Array<{ content }>,
//     links?: Array<{ url, title? }>
//   }>
//   savedTranscriptions?: Array<{ url, title, text, language, duration?, segments? }>
//   scripts?: Array<{ title, content }>
//   keyPrinciples?: Array<{ title, content }>
//   scriptStyles?: Array<{ name, description?, guidelines? }>
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userId = session.user.id;

    let projectsImported = 0;
    let tasksImported = 0;
    let notesImported = 0;
    let linksImported = 0;
    let transcriptionsImported = 0;
    let scriptsImported = 0;
    let keyPrinciplesImported = 0;
    let scriptStylesImported = 0;

    // ── Projects (with nested tasks, notes, links) ──────────────
    if (Array.isArray(body.projects)) {
      for (const project of body.projects) {
        const { tasks, notes, links, ...projectData } = project;

        const created = await prisma.project.create({
          data: {
            userId,
            name: projectData.name,
            description: projectData.description ?? null,
            color: projectData.color ?? '#7fd858',
            status: projectData.status ?? 'ACTIVE',
          },
        });
        projectsImported++;

        // Tasks
        if (Array.isArray(tasks) && tasks.length > 0) {
          await prisma.task.createMany({
            data: tasks.map(
              (task: {
                title: string;
                description?: string;
                dueDate?: string;
                priority?: string;
                completed?: boolean;
              }) => ({
                projectId: created.id,
                title: task.title,
                description: task.description ?? null,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                priority: task.priority ?? 'MEDIUM',
                completed: task.completed ?? false,
              })
            ),
          });
          tasksImported += tasks.length;
        }

        // Notes
        if (Array.isArray(notes) && notes.length > 0) {
          await prisma.note.createMany({
            data: notes.map((note: { content: string }) => ({
              projectId: created.id,
              content: note.content,
            })),
          });
          notesImported += notes.length;
        }

        // Links
        if (Array.isArray(links) && links.length > 0) {
          await prisma.projectLink.createMany({
            data: links.map((link: { url: string; title?: string }) => ({
              projectId: created.id,
              url: link.url,
              title: link.title ?? null,
            })),
          });
          linksImported += links.length;
        }
      }
    }

    // ── Saved Transcriptions ────────────────────────────────────
    if (Array.isArray(body.savedTranscriptions)) {
      await prisma.savedTranscription.createMany({
        data: body.savedTranscriptions.map(
          (t: {
            url: string;
            title: string;
            text: string;
            language: string;
            duration?: number;
            segments?: string;
          }) => ({
            userId,
            url: t.url,
            title: t.title,
            text: t.text,
            language: t.language,
            duration: t.duration ?? null,
            segments: t.segments ?? null,
          })
        ),
      });
      transcriptionsImported = body.savedTranscriptions.length;
    }

    // ── Scripts ─────────────────────────────────────────────────
    if (Array.isArray(body.scripts)) {
      await prisma.script.createMany({
        data: body.scripts.map(
          (s: { title: string; content: string }) => ({
            userId,
            title: s.title,
            content: s.content,
          })
        ),
      });
      scriptsImported = body.scripts.length;
    }

    // ── Key Principles ──────────────────────────────────────────
    if (Array.isArray(body.keyPrinciples)) {
      await prisma.keyPrinciple.createMany({
        data: body.keyPrinciples.map(
          (kp: { title: string; content: string }) => ({
            userId,
            title: kp.title,
            content: kp.content,
          })
        ),
      });
      keyPrinciplesImported = body.keyPrinciples.length;
    }

    // ── Script Styles ───────────────────────────────────────────
    if (Array.isArray(body.scriptStyles)) {
      await prisma.scriptStyle.createMany({
        data: body.scriptStyles.map(
          (ss: { name: string; description?: string; guidelines?: string }) => ({
            userId,
            name: ss.name,
            description: ss.description ?? null,
            guidelines: ss.guidelines ?? null,
          })
        ),
      });
      scriptStylesImported = body.scriptStyles.length;
    }

    return NextResponse.json({
      imported: {
        projects: projectsImported,
        tasks: tasksImported,
        notes: notesImported,
        links: linksImported,
        transcriptions: transcriptionsImported,
        scripts: scriptsImported,
        keyPrinciples: keyPrinciplesImported,
        scriptStyles: scriptStylesImported,
      },
    });
  } catch (error) {
    console.error('Failed to import data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
