/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (externalId: string) =>
      ctx.db.insert("users", {
        externalId, name: externalId, lastname: "", username: externalId, slug: externalId,
        description: "", email: `${externalId}@example.com`, contact: "", avatar: "",
        totalExp: BigInt(0), friends: [], publicKey: `pk-${externalId}`,
      });
    const a = await user("a");
    const b = await user("b");
    const outsider = await user("outsider");
    const teamId = await ctx.db.insert("teams", {
      teamName: "T", teamDescription: "", teammates: [a, b], createdBy: a, slug: "t",
    });
    return { a, b, outsider, teamId };
  });
  const as = (externalId: string) => t.withIdentity({ subject: externalId });
  return { t, as, ...ids };
}

test("first key is created once; later resets are refused", async () => {
  const { as, a, b, teamId } = await setup();
  await as("a").mutation(api.teams.setTeamKeys, {
    teamId, reset: true,
    keys: [{ userId: a, wrappedKey: "A1", memberPublicKey: "pk-a" }],
  });
  // b racing with its own key: refused, a's key survives
  const res = await as("b").mutation(api.teams.setTeamKeys, {
    teamId, reset: true,
    keys: [{ userId: b, wrappedKey: "B-own", memberPublicKey: "pk-b" }],
  });
  expect(res.success).toBe(false);
  expect((await as("a").query(api.teams.getTeamKeys, { teamId }))?.myWrappedKey).toBe("A1");
  expect((await as("b").query(api.teams.getTeamKeys, { teamId }))?.myWrappedKey).toBeNull();
});

test("key holders share with missing members only; others can't write", async () => {
  const { t, as, a, b, outsider, teamId } = await setup();
  await as("a").mutation(api.teams.setTeamKeys, {
    teamId, reset: true, keys: [{ userId: a, wrappedKey: "A1", memberPublicKey: "pk-a" }],
  });
  // b doesn't hold the key, so it can't write keys
  await expect(as("b").mutation(api.teams.setTeamKeys, {
    teamId, reset: false, keys: [{ userId: b, wrappedKey: "x", memberPublicKey: "pk-b" }],
  })).rejects.toThrow();
  await expect(as("outsider").query(api.teams.getTeamKeys, { teamId })).resolves.toBeNull();

  // a shares with b; a's own valid key and a stale-pubkey/outsider entry are ignored
  await as("a").mutation(api.teams.setTeamKeys, {
    teamId, reset: false,
    keys: [
      { userId: b, wrappedKey: "B1", memberPublicKey: "pk-b" },
      { userId: a, wrappedKey: "overwrite", memberPublicKey: "pk-a" },
      { userId: outsider, wrappedKey: "O", memberPublicKey: "pk-outsider" },
    ],
  });
  expect((await as("b").query(api.teams.getTeamKeys, { teamId }))?.myWrappedKey).toBe("B1");
  expect((await as("a").query(api.teams.getTeamKeys, { teamId }))?.myWrappedKey).toBe("A1");

  // b switches browser -> its key is stale until re-wrapped
  await t.run((ctx) => ctx.db.patch(b, { publicKey: "pk-b2" }));
  expect((await as("b").query(api.teams.getTeamKeys, { teamId }))?.myWrappedKey).toBeNull();

  // leaving drops the member's key
  await as("b").mutation(api.teams.leaveTeam, { teamId });
  const rows = await t.run((ctx) => ctx.db.query("teamKeys").collect());
  expect(rows.map((r) => r.userId)).toEqual([a]);
});

test("public key can't be silently overwritten by a second browser", async () => {
  const { t, as, a: aliceId } = await setup();
  await t.run((ctx) => ctx.db.patch(aliceId, { publicKey: undefined }));
  await as("a").mutation(api.users.setMyPublicKey, { publicKey: '{"x":"1","y":"1"}', replace: false });
  await expect(
    as("a").mutation(api.users.setMyPublicKey, { publicKey: '{"x":"2","y":"2"}', replace: false })
  ).rejects.toThrow();
  expect((await as("a").query(api.users.current, {}))?.publicKey).toBe('{"x":"1","y":"1"}');
});

test("device link: only the owner sees, approves and reads their requests", async () => {
  const { as } = await setup();
  const linkId = await as("a").mutation(api.users.requestDeviceLink, { tempPublicKey: '{"x":"t","y":"t"}' });
  expect(await as("a").query(api.users.getPendingDeviceLinks, {})).toHaveLength(1);
  expect(await as("b").query(api.users.getPendingDeviceLinks, {})).toEqual([]);
  await expect(as("b").mutation(api.users.approveDeviceLink, { linkId, payload: "evil" })).rejects.toThrow();
  expect(await as("b").query(api.users.getDeviceLink, { linkId })).toBeNull();

  await as("a").mutation(api.users.approveDeviceLink, { linkId, payload: "ciphertext" });
  expect(await as("a").query(api.users.getDeviceLink, { linkId })).toEqual({ payload: "ciphertext" });
  expect(await as("a").query(api.users.getPendingDeviceLinks, {})).toEqual([]);
  // can't be approved twice (e.g. swapped after the fact)
  await expect(as("a").mutation(api.users.approveDeviceLink, { linkId, payload: "other" })).rejects.toThrow();
});

test("replacing a key records a security code change; first setup doesn't", async () => {
  const { t, as, a: aliceId } = await setup();
  // same x/y in a different JSON field order is not a change
  await t.run((ctx) => ctx.db.patch(aliceId, { publicKey: '{"x":"1","y":"1","kty":"EC"}' }));
  await as("a").mutation(api.users.setMyPublicKey, { publicKey: '{"kty":"EC","x":"1","y":"1"}', replace: true });
  expect(await as("b").query(api.users.getKeyChanges, { otherUserId: aliceId })).toEqual([]);

  await as("a").mutation(api.users.setMyPublicKey, { publicKey: '{"x":"2","y":"2"}', replace: true });
  const changes = await as("b").query(api.users.getKeyChanges, { otherUserId: aliceId });
  expect(changes.map((c) => c.userId)).toEqual([aliceId]);
});
