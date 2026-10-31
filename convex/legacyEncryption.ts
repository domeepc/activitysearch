import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { EncryptionService } from "../lib/encryption";

/**
 * One-off clean-up of the first ("symmetric") chat encryption. Its keys were derived from the user
 * or team IDs with a fixed salt that ships in the app, so anyone could rebuild them: those messages
 * were never really secret. This turns them back into plain text; each author's browser then
 * re-encrypts its own messages with the current scheme. Rows that don't decrypt are left untouched.
 *
 * Run once per deployment:  npx convex run legacyEncryption:decryptLegacyMessages
 */

const legacyTable = v.union(v.literal("messages"), v.literal("groupMessages"));

// The original derivation: PBKDF2-SHA256, 100k iterations, fixed salt, 256-bit AES-GCM key
async function legacyKey(material: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", encoder.encode(material), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode("activitysearch_e2e_salt_v1"), iterations: 100_000, hash: "SHA-256" },
    base,
    256
  );
  return await crypto.subtle.importKey("raw", bits, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}

function isLegacy(row: { encrypted?: boolean; encryptionVersion?: string }) {
  return row.encrypted === true && (row.encryptionVersion ?? "symmetric") === "symmetric";
}

export const legacyPage = internalQuery({
  args: { table: legacyTable, cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { table, cursor }) => {
    const page = await ctx.db.query(table).paginate({ cursor, numItems: 200 });
    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      rows: page.page.filter(isLegacy).map((row) => ({
        _id: row._id,
        text: row.text,
        keyMaterial:
          "teamId" in row
            ? String(row.teamId)
            : [String(row.senderId), String(row.receiverId)].sort((a, b) => a.localeCompare(b)).join("_"),
      })),
    };
  },
});

export const storeDecrypted = internalMutation({
  args: { id: v.union(v.id("messages"), v.id("groupMessages")), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const row = await ctx.db.get(id);
    if (!row || !isLegacy(row)) return; // changed since we read it
    await ctx.db.patch(id, { text, encrypted: undefined, encryptionVersion: undefined });
  },
});

export const decryptLegacyMessages = internalAction({
  args: {},
  handler: async (ctx): Promise<{ converted: number; undecryptable: number }> => {
    let converted = 0;
    let undecryptable = 0;
    const keys = new Map<string, Promise<CryptoKey>>();
    for (const table of ["messages", "groupMessages"] as const) {
      let cursor: string | null = null;
      for (;;) {
        const page: { isDone: boolean; continueCursor: string; rows: { _id: Id<"messages"> | Id<"groupMessages">; text: string; keyMaterial: string }[] } =
          await ctx.runQuery(internal.legacyEncryption.legacyPage, { table, cursor });
        for (const row of page.rows) {
          if (!keys.has(row.keyMaterial)) keys.set(row.keyMaterial, legacyKey(row.keyMaterial));
          try {
            const text = await EncryptionService.decryptMessage(row.text, await keys.get(row.keyMaterial)!);
            await ctx.runMutation(internal.legacyEncryption.storeDecrypted, {
              id: row._id,
              text,
            });
            converted++;
          } catch {
            undecryptable++;
          }
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
    }
    return { converted, undecryptable };
  },
});

/**
 * Deletes the removed passcode backups (encrypted private keys someone could try to guess offline)
 * and the unused team public keys. Run once per deployment, then drop `keyBackups` and
 * `teams.teamPublicKey` from the schema:  npx convex run legacyEncryption:dropLegacyKeyData
 */
export const dropLegacyKeyData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const backups = await ctx.db.query("keyBackups").collect();
    for (const row of backups) await ctx.db.delete(row._id);
    let teams = 0;
    for (const team of await ctx.db.query("teams").collect()) {
      if (team.teamPublicKey !== undefined) {
        await ctx.db.patch(team._id, { teamPublicKey: undefined });
        teams++;
      }
    }
    return { deletedBackups: backups.length, clearedTeamKeys: teams };
  },
});
