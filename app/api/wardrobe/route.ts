import { loadSnapshot, route } from "@/lib/server/wardrobe";

export const dynamic = "force-dynamic";

/** GET /api/wardrobe: the signed-in user's whole wardrobe (items with signed photo URLs). */
export const GET = route(async ({ sb }) => Response.json({ snapshot: await loadSnapshot(sb) }));
