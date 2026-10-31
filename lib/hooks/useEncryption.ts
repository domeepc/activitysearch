"use client";

import { useState, useEffect, useCallback } from "react";
import { EncryptionService } from "@/lib/encryption";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type EncryptionVersion = "symmetric" | "asymmetric" | "teamKey";

interface UseEncryptionReturn {
  encryptMessage: (text: string, encryptionVersion?: EncryptionVersion) => Promise<string>;
  decryptMessage: (encryptedText: string, isEncrypted: boolean, encryptionVersion?: EncryptionVersion) => Promise<string>;
  isEncryptionReady: boolean;
  isEncryptionAvailable: boolean;
  encryptionError: string | null;
  keyStatus: KeyStatus;
  /** This browser's own public key (for security codes) and the contact's key as the server reports it */
  ownPublicKey: CryptoKey | null;
  otherPublicKeyJWK: string | null;
  /** 6-digit code this browser shows while waiting for approval from another browser */
  linkCode: string | null;
  /** The link request was denied or expired */
  linkFailed: boolean;
  requestNewLink: () => Promise<void>;
  startFresh: () => Promise<void>;
}

type KeyStatus = "loading" | "ready" | "needsLink";

interface DeviceLinkRequest {
  id: Id<"deviceLinks">;
  tempPublicJWK: string;
  tempPrivateJWK: string;
}

// One in-flight request per tab, so effects running twice (StrictMode, remounts) don't open two
let linkInFlight: Promise<DeviceLinkRequest> | null = null;

async function startDeviceLink(
  keyName: string,
  request: (args: { tempPublicKey: string }) => Promise<Id<"deviceLinks">>
): Promise<DeviceLinkRequest> {
  linkInFlight ??= (async () => {
    const temp = await EncryptionService.generateKeyPair();
    const tempPublicJWK = await EncryptionService.exportPublicKeyAsJWK(temp);
    const tempPrivateJWK = JSON.stringify(await crypto.subtle.exportKey("jwk", temp.privateKey));
    const id = await request({ tempPublicKey: tempPublicJWK });
    const value = { id, tempPublicJWK, tempPrivateJWK };
    sessionStorage.setItem(`${keyName}_link`, JSON.stringify(value));
    return value;
  })().finally(() => {
    linkInFlight = null;
  });
  return linkInFlight;
}

/**
 * Hook variant that accepts current user ID for individual chats
 * Uses asymmetric ECDH encryption with public/private key pairs
 */
export function useEncryptionWithUser({
  currentUserId,
  otherUserId,
  teamId,
}: {
  currentUserId?: Id<"users">;
  otherUserId?: Id<"users">;
  teamId?: Id<"teams">;
}): UseEncryptionReturn {
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [userKeyPair, setUserKeyPair] = useState<CryptoKeyPair | null>(null);
  const [receiverPublicKey, setReceiverPublicKey] = useState<CryptoKey | null>(null);
  const [teamKey, setTeamKey] = useState<CryptoKey | null>(null);
  const isEncryptionAvailable = EncryptionService.isEncryptionAvailable();

  // Fetch receiver's public key from database
  const receiverPublicKeyJWK = useQuery(
    api.users.getUserPublicKey,
    otherUserId ? { userId: otherUserId } : "skip"
  );

  // Our wrapped copy of the team key + which members still need one
  const teamKeys = useQuery(api.teams.getTeamKeys, teamId ? { teamId } : "skip");

  const me = useQuery(api.users.current);
  const serverPublicKey = me === undefined ? undefined : (me?.publicKey ?? null);
  const setMyPublicKeyMutation = useMutation(api.users.setMyPublicKey);
  const requestDeviceLinkMutation = useMutation(api.users.requestDeviceLink);
  const deleteDeviceLinkMutation = useMutation(api.users.deleteDeviceLink);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("loading");
  const [link, setLink] = useState<DeviceLinkRequest | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);
  const keyName = currentUserId ? EncryptionService.userKeyName(String(currentUserId)) : null;
  const linkState = useQuery(api.users.getDeviceLink, link ? { linkId: link.id } : "skip");

  // Use this browser's key if it's the one on the server; the very first browser creates one;
  // any other browser has to be approved by one that already has it
  useEffect(() => {
    if (!keyName || serverPublicKey === undefined || !isEncryptionAvailable) return;
    let cancelled = false;
    (async () => {
      const local = await EncryptionService.loadKeyPair(keyName);
      if (serverPublicKey === null) {
        const keyPair = local ?? (await EncryptionService.generateKeyPair());
        await EncryptionService.storeKeyPair(keyName, keyPair);
        // On success the `me` query updates and reruns this effect; if another browser won the race, we end up linking
        await setMyPublicKeyMutation({
          publicKey: await EncryptionService.exportPublicKeyAsJWK(keyPair),
          replace: false,
        }).catch(() => {});
        return;
      }
      const matches =
        !!local &&
        EncryptionService.samePublicKey(await EncryptionService.exportPublicKeyAsJWK(local), serverPublicKey);
      if (cancelled) return;
      setUserKeyPair(matches ? local : null);
      setKeyStatus(matches ? "ready" : "needsLink");
    })();
    return () => {
      cancelled = true;
    };
  }, [keyName, serverPublicKey, isEncryptionAvailable, setMyPublicKeyMutation]);

  const requestNewLink = useCallback(async () => {
    if (!keyName) return;
    setLinkFailed(false);
    sessionStorage.removeItem(`${keyName}_link`);
    const request = await startDeviceLink(keyName, requestDeviceLinkMutation);
    setLink(request);
    setLinkCode(await EncryptionService.linkCode(request.tempPublicJWK));
  }, [keyName, requestDeviceLinkMutation]);

  // Needs linking: resume this tab's pending request (survives navigation) or open a new one
  useEffect(() => {
    if (keyStatus !== "needsLink" || !keyName || link || linkFailed) return;
    let cancelled = false;
    (async () => {
      const saved = sessionStorage.getItem(`${keyName}_link`);
      const request: DeviceLinkRequest = saved
        ? JSON.parse(saved)
        : await startDeviceLink(keyName, requestDeviceLinkMutation);
      const code = await EncryptionService.linkCode(request.tempPublicJWK);
      if (cancelled) return;
      setLink(request);
      setLinkCode(code);
    })().catch((error) => setEncryptionError(error instanceof Error ? error.message : "Linking failed"));
    return () => {
      cancelled = true;
    };
  }, [keyStatus, keyName, link, linkFailed, requestDeviceLinkMutation]);

  // Approved: decrypt the key the other browser sent and adopt it. Gone: denied or expired.
  useEffect(() => {
    if (!link || !keyName || linkState === undefined || serverPublicKey === undefined) return;
    if (linkState && !linkState.payload) return;
    (async () => {
      if (linkState === null) {
        sessionStorage.removeItem(`${keyName}_link`);
        setLink(null);
        setLinkCode(null);
        setLinkFailed(true);
        return;
      }
      const tempPrivateKey = await crypto.subtle.importKey(
        "jwk",
        JSON.parse(link.tempPrivateJWK),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey", "deriveBits"]
      );
      const privateJWK = await EncryptionService.decryptMessageAsymmetric(linkState.payload!, tempPrivateKey);
      const { x, y } = JSON.parse(privateJWK);
      if (!serverPublicKey || !EncryptionService.samePublicKey(JSON.stringify({ x, y }), serverPublicKey)) {
        throw new Error("Received key doesn't match your account's key");
      }
      localStorage.setItem(keyName, privateJWK);
      const keyPair = await EncryptionService.loadKeyPair(keyName);
      if (!keyPair) throw new Error("Received key is invalid");
      sessionStorage.removeItem(`${keyName}_link`);
      // Clear local state before deleting, or the deletion would read as "denied"
      setLink(null);
      setLinkCode(null);
      setUserKeyPair(keyPair);
      setKeyStatus("ready");
      deleteDeviceLinkMutation({ linkId: link.id }).catch(() => {});
    })().catch((error) => setEncryptionError(error instanceof Error ? error.message : "Linking failed"));
  }, [link, linkState, keyName, serverPublicKey, deleteDeviceLinkMutation]);

  /** No other browser left: new key pair; messages encrypted to the old key become unreadable */
  const startFresh = useCallback(async () => {
    if (!keyName) return;
    const keyPair = await EncryptionService.generateKeyPair();
    await EncryptionService.storeKeyPair(keyName, keyPair);
    await setMyPublicKeyMutation({ publicKey: await EncryptionService.exportPublicKeyAsJWK(keyPair), replace: true });
    if (link) await deleteDeviceLinkMutation({ linkId: link.id }).catch(() => {});
    sessionStorage.removeItem(`${keyName}_link`);
    setLink(null);
    setLinkCode(null);
    setUserKeyPair(keyPair);
    setKeyStatus("ready");
  }, [keyName, link, setMyPublicKeyMutation, deleteDeviceLinkMutation]);

  const setTeamKeysMutation = useMutation(api.teams.setTeamKeys);

  // Initialize user's private key pair and fetch receiver's public key
  useEffect(() => {
    let cancelled = false;

    const initializeEncryption = async () => {
      if (!isEncryptionAvailable) {
        setIsEncryptionReady(false);
        setEncryptionError("Encryption is not available in this browser");
        return;
      }

      if (!currentUserId || !userKeyPair) {
        setIsEncryptionReady(false);
        return;
      }

      try {
        setEncryptionError(null);
        const keyPair = userKeyPair;

        // For individual chats: fetch receiver's public key
        if (otherUserId && !teamId) {
          if (receiverPublicKeyJWK) {
            try {
              const receiverKey = await EncryptionService.importPublicKeyFromJWK(receiverPublicKeyJWK);
              if (!cancelled) {
                setReceiverPublicKey(receiverKey);
                setIsEncryptionReady(true);
              }
            } catch (error) {
              if (!cancelled) {
                setEncryptionError(
                  `Failed to import receiver's public key: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                setIsEncryptionReady(false);
              }
            }
          } else if (receiverPublicKeyJWK === null) {
            // Receiver doesn't have a public key yet
            if (!cancelled) {
              setEncryptionError("Receiver's public key not available. They may need to enable encryption.");
              setIsEncryptionReady(false);
            }
          }
        }

        // For team chats: unwrap our copy of the team key, share it with members missing one,
        // or create the team's first key if nobody holds one
        if (teamId && teamKeys) {
          const wrapFor = async (key: CryptoKey, reset: boolean) => {
            const targets = teamKeys.members.filter((m) => m.publicKey && (reset || !m.hasKey));
            if (targets.length === 0) return;
            const keys = await Promise.all(
              targets.map(async (m) => ({
                userId: m.userId,
                memberPublicKey: m.publicKey!,
                wrappedKey: await EncryptionService.wrapTeamKey(
                  key,
                  await EncryptionService.importPublicKeyFromJWK(m.publicKey!),
                  keyPair
                ),
              }))
            );
            await setTeamKeysMutation({ teamId, reset, keys });
          };

          if (teamKeys.myWrappedKey) {
            const key = await EncryptionService.unwrapTeamKey(teamKeys.myWrappedKey, keyPair.privateKey);
            if (!cancelled) {
              setTeamKey(key);
              setIsEncryptionReady(true);
            }
            await wrapFor(key, false).catch((error) => console.warn("Failed to share team key:", error));
          } else if (!teamKeys.members.some((m) => m.hasKey)) {
            // Only used once the server accepts it and our wrapped copy comes back through the query
            await wrapFor(await EncryptionService.generateTeamKey(), true);
          } else if (!cancelled) {
            setTeamKey(null);
            setEncryptionError("Waiting for a teammate to open this chat and share the team key");
            setIsEncryptionReady(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setEncryptionError(
            error instanceof Error ? error.message : "Failed to initialize encryption"
          );
          setIsEncryptionReady(false);
        }
      }
    };

    initializeEncryption();

    return () => {
      cancelled = true;
    };
  }, [
    currentUserId,
    otherUserId,
    teamId,
    isEncryptionAvailable,
    receiverPublicKeyJWK,
    teamKeys,
    userKeyPair,
    setTeamKeysMutation,
  ]);

  /**
   * Encrypt a message before sending
   * Uses asymmetric encryption with receiver's public key
   */
  const encryptMessage = useCallback(
    async (text: string, encryptionVersion: EncryptionVersion = "asymmetric"): Promise<string> => {
      if (!isEncryptionAvailable) {
        throw new Error("Encryption is not available");
      }

      if (encryptionVersion === "teamKey") {
        if (!teamKey) throw new Error("Team key not available");
        return await EncryptionService.encryptMessage(text, teamKey);
      }

      if (encryptionVersion === "symmetric") {
        throw new Error("The legacy symmetric scheme is no longer used for new messages");
      }

      // Asymmetric encryption
      if (!userKeyPair) {
        throw new Error("Encryption key pair not ready");
      }

      const publicKey = receiverPublicKey;
      if (!publicKey) {
        throw new Error("Receiver's public key not available");
      }

      try {
        return await EncryptionService.encryptMessageAsymmetric(text, publicKey, userKeyPair);
      } catch (error) {
        throw new Error(
          `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [userKeyPair, receiverPublicKey, teamKey, isEncryptionAvailable]
  );

  /**
   * Decrypt a message after receiving
   * Uses asymmetric decryption with user's private key
   */
  const decryptMessage = useCallback(
    async (
      encryptedText: string,
      isEncrypted: boolean,
      encryptionVersion: EncryptionVersion = "asymmetric"
    ): Promise<string> => {
      // If message is not encrypted, return as-is
      if (!isEncrypted) {
        return encryptedText;
      }

      if (!isEncryptionAvailable) {
        throw new Error("Encryption is not available - cannot decrypt message");
      }

      if (encryptionVersion === "teamKey") {
        if (!teamKey) throw new Error("Team key not available - cannot decrypt message");
        return await EncryptionService.decryptMessage(encryptedText, teamKey);
      }

      // Legacy rows are converted to plain text by convex/legacyEncryption.ts; any left didn't decrypt
      if (encryptionVersion === "symmetric") {
        throw new Error("Legacy message could not be recovered");
      }

      // Asymmetric decryption
      if (!userKeyPair) {
        throw new Error("Encryption key pair not ready - cannot decrypt message");
      }

      try {
        return await EncryptionService.decryptMessageAsymmetric(
          encryptedText,
          userKeyPair.privateKey,
          userKeyPair.publicKey,
          receiverPublicKey ?? undefined
        );
      } catch (error) {
        throw new Error(
          `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [userKeyPair, receiverPublicKey, teamKey, isEncryptionAvailable]
  );

  return {
    encryptMessage,
    decryptMessage,
    isEncryptionReady,
    isEncryptionAvailable,
    encryptionError,
    keyStatus,
    ownPublicKey: userKeyPair?.publicKey ?? null,
    otherPublicKeyJWK: receiverPublicKeyJWK ?? null,
    linkCode,
    linkFailed,
    requestNewLink,
    startFresh,
  };
}
