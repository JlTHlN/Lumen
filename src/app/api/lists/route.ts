import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listItems, lists, mediaItems } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { getLibraryForMediaIds, getLists, toMediaRecord } from "@/lib/library";

export const dynamic = "force-dynamic";

interface Body {
  action: string;
  id?: number;
  name?: string;
  description?: string | null;
  mediaType?: string;
  mediaId?: number;
  order?: number[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") ?? 0);
  try {
    if (id) {
      const listRows = await db.select().from(lists).where(eq(lists.id, id)).limit(1);
      if (!listRows.length) return fail("List not found", 404);
      const itemRows = await db
        .select({ item: listItems, media: mediaItems })
        .from(listItems)
        .innerJoin(mediaItems, eq(listItems.mediaId, mediaItems.id))
        .where(eq(listItems.listId, id))
        .orderBy(listItems.sortOrder, listItems.id);
      const entries = await getLibraryForMediaIds(itemRows.map((row) => row.media.id));
      return ok({
        list: listRows[0],
        items: itemRows.map((row) => ({
          media: toMediaRecord(row.media),
          entry: entries.get(row.media.id) ?? null,
        })),
      });
    }
    return ok({ lists: await getLists() });
  } catch {
    return fail("We couldn't load your lists right now.", 503, { lists: [] });
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("Invalid request");
  }

  try {
    switch (body.action) {
      case "create": {
        if (!body.name?.trim()) return fail("Give your list a name");
        const count = await db.select({ value: sql<number>`count(*)::int` }).from(lists);
        const inserted = await db
          .insert(lists)
          .values({
            name: body.name.trim(),
            description: body.description ?? null,
            mediaType: body.mediaType ?? "all",
            sortOrder: Number(count[0]?.value ?? 0),
          })
          .returning();
        return ok({ list: inserted[0], lists: await getLists() });
      }
      case "rename": {
        if (!body.id) return fail("Missing list");
        await db
          .update(lists)
          .set({
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
            ...(body.mediaType !== undefined ? { mediaType: body.mediaType } : {}),
            updatedAt: new Date(),
          })
          .where(eq(lists.id, body.id));
        return ok({ lists: await getLists() });
      }
      case "delete": {
        if (!body.id) return fail("Missing list");
        await db.delete(lists).where(eq(lists.id, body.id));
        return ok({ lists: await getLists() });
      }
      case "reorder": {
        await Promise.all(
          (body.order ?? []).map((listId, index) => db.update(lists).set({ sortOrder: index }).where(eq(lists.id, listId))),
        );
        return ok({ lists: await getLists() });
      }
      case "reorder_items": {
        if (!body.id) return fail("Missing list");
        await Promise.all(
          (body.order ?? []).map((mediaId, index) =>
            db
              .update(listItems)
              .set({ sortOrder: index })
              .where(and(eq(listItems.listId, body.id!), eq(listItems.mediaId, mediaId))),
          ),
        );
        return ok({ lists: await getLists() });
      }
      case "add_item": {
        if (!body.id || !body.mediaId) return fail("Missing list or item");
        const count = await db
          .select({ value: sql<number>`count(*)::int` })
          .from(listItems)
          .where(eq(listItems.listId, body.id));
        await db
          .insert(listItems)
          .values({ listId: body.id, mediaId: body.mediaId, sortOrder: Number(count[0]?.value ?? 0) })
          .onConflictDoNothing();
        return ok({ lists: await getLists() });
      }
      case "remove_item": {
        if (!body.id || !body.mediaId) return fail("Missing list or item");
        await db
          .delete(listItems)
          .where(and(eq(listItems.listId, body.id), eq(listItems.mediaId, body.mediaId)));
        return ok({ lists: await getLists() });
      }
      default:
        return fail("Unknown action");
    }
  } catch {
    return fail("We couldn't update that list.", 500);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") ?? 0);
  if (!id) return fail("Missing list");
  await db.delete(listItems).where(eq(listItems.listId, id));
  await db.delete(lists).where(eq(lists.id, id));
  return ok({ lists: await getLists() });
}
