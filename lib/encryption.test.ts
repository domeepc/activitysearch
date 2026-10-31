import { describe, expect, it } from "vitest";
import { EncryptionService as E } from "./encryption";

describe("asymmetric 1:1 encryption", () => {
  it("both sender and receiver can decrypt, outsiders cannot", async () => {
    const alice = await E.generateKeyPair();
    const bob = await E.generateKeyPair();
    const eve = await E.generateKeyPair();

    const ct = await E.encryptMessageAsymmetric("hi bob", bob.publicKey, alice);
    expect(ct).not.toContain("hi bob");

    // receiver (embedded key is alice's, not bob's own)
    expect(await E.decryptMessageAsymmetric(ct, bob.privateKey, bob.publicKey, alice.publicKey)).toBe("hi bob");
    // sender reading their own message
    expect(await E.decryptMessageAsymmetric(ct, alice.privateKey, alice.publicKey, bob.publicKey)).toBe("hi bob");
    await expect(E.decryptMessageAsymmetric(ct, eve.privateKey, eve.publicKey, alice.publicKey)).rejects.toThrow();
  });

  it("still decrypts legacy ephemeral-key messages for the receiver", async () => {
    const bob = await E.generateKeyPair();
    const ephemeral = await E.generateKeyPair();
    const ct = await E.encryptMessageAsymmetric("old", bob.publicKey, ephemeral);
    expect(await E.decryptMessageAsymmetric(ct, bob.privateKey)).toBe("old");
  });
});

describe("team key wrapping", () => {
  it("every member unwraps the same key; non-members cannot", async () => {
    const [alice, bob, eve] = await Promise.all([E.generateKeyPair(), E.generateKeyPair(), E.generateKeyPair()]);
    const teamKey = await E.generateTeamKey();
    const forAlice = await E.wrapTeamKey(teamKey, alice.publicKey, alice); // self-wrap at creation
    const forBob = await E.wrapTeamKey(teamKey, bob.publicKey, alice);

    const ct = await E.encryptMessage("team hi", teamKey);
    expect(await E.decryptMessage(ct, await E.unwrapTeamKey(forAlice, alice.privateKey))).toBe("team hi");
    expect(await E.decryptMessage(ct, await E.unwrapTeamKey(forBob, bob.privateKey))).toBe("team hi");
    await expect(E.unwrapTeamKey(forBob, eve.privateKey)).rejects.toThrow();
  });
});

describe("device linking", () => {
  it("new browser receives the exact private key; the code matches on both sides", async () => {
    const account = await E.generateKeyPair();
    const temp = await E.generateKeyPair(); // new browser
    const tempPub = await E.exportPublicKeyAsJWK(temp);

    const privateJWK = JSON.stringify(await crypto.subtle.exportKey("jwk", account.privateKey));
    const payload = await E.encryptMessageAsymmetric(privateJWK, temp.publicKey, account); // approver
    expect(await E.decryptMessageAsymmetric(payload, temp.privateKey)).toBe(privateJWK);

    const outsider = await E.generateKeyPair();
    await expect(E.decryptMessageAsymmetric(payload, outsider.privateKey)).rejects.toThrow();
    expect(await E.linkCode(tempPub)).toMatch(/^\d{6}$/);
    expect(await E.linkCode(tempPub)).toBe(await E.linkCode(tempPub));
  });
});

describe("security code", () => {
  it("is 60 digits, identical on both sides, and changes when a key changes", async () => {
    const [alice, bob, mallory] = await Promise.all([E.generateKeyPair(), E.generateKeyPair(), E.generateKeyPair()]);
    const A = { userId: "a", publicKeyJWK: await E.exportPublicKeyAsJWK(alice) };
    const B = { userId: "b", publicKeyJWK: await E.exportPublicKeyAsJWK(bob) };
    const code = await E.securityCode(A, B);
    expect(code).toMatch(/^\d{60}$/);
    expect(await E.securityCode(B, A)).toBe(code);
    // server swapped bob's key for mallory's: alice's code no longer matches bob's
    expect(await E.securityCode(A, { userId: "b", publicKeyJWK: await E.exportPublicKeyAsJWK(mallory) })).not.toBe(code);
  });
});
