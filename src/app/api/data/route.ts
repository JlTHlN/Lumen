import { fail, ok } from "@/lib/api";
import {
  buildExport,
  exportAsText,
  importBackup,
  summarizeImport,
  deleteAllUserData,
  type BackupFile,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  try {
    const backup = await buildExport();
    if (format === "txt") {
      return new Response(exportAsText(backup), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="reelmark-backup.txt"`,
        },
      });
    }
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="reelmark-backup.json"`,
      },
    });
  } catch {
    return fail("We couldn't build your backup right now.", 503);
  }
}

interface Body {
  action: "summarize" | "import" | "delete";
  payload?: BackupFile;
  mode?: "merge" | "replace";
  refetch?: boolean;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("Invalid request");
  }

  try {
    if (body.action === "summarize") {
      const summary = await summarizeImport(body.payload);
      const version = body.payload?.export_version;
      return ok({ summary, supported: version === 1 || version === undefined });
    }
    if (body.action === "import") {
      const version = body.payload?.export_version;
      if (version !== 1 && version !== undefined) {
        return fail("This backup was made with a newer version and cannot be imported yet.");
      }
      const summary = await importBackup(body.payload, {
        mode: body.mode ?? "merge",
        refetch: body.refetch ?? false,
      });
      return ok({ imported: true, summary });
    }
    if (body.action === "delete") {
      await deleteAllUserData();
      return ok({ deleted: true });
    }
    return fail("Unknown action");
  } catch {
    return fail("We couldn't process that backup file.", 500);
  }
}
