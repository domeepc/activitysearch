"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EncryptionService } from "@/lib/encryption";

const LOCKED = "🔒 Encrypted message";

// Cached per account key so a long list doesn't re-import keys for every row
const ownKeyCache = new Map<string, Promise<CryptoKeyPair | null>>();
const teamKeyCache = new Map<string, Promise<CryptoKey>>();

function loadOwnKey(userId: string, serverPublicKey: string) {
  const cacheKey = `${userId}:${serverPublicKey}`;
  if (!ownKeyCache.has(cacheKey)) {
    ownKeyCache.set(
      cacheKey,
      (async () => {
        const local = await EncryptionService.loadKeyPair(EncryptionService.userKeyName(userId));
        if (!local) return null;
        const matches = EncryptionService.samePublicKey(
          await EncryptionService.exportPublicKeyAsJWK(local),
          serverPublicKey
        );
        return matches ? local : null;
      })()
    );
  }
  return ownKeyCache.get(cacheKey)!;
}

interface LastMessagePreviewProps {
  text: string;
  encryptionVersion: "symmetric" | "asymmetric" | "teamKey" | null | undefined;
  /** 1:1 chats: the other person's public key */
  partnerPublicKey?: string | null;
  /** Team chats: our wrapped copy of the team key */
  wrappedTeamKey?: string | null;
}

/** Sidebar preview of a conversation's last message, decrypted in the browser */
export function LastMessagePreview({
  text,
  encryptionVersion,
  partnerPublicKey,
  wrappedTeamKey,
}: LastMessagePreviewProps) {
  const me = useQuery(api.users.current);
  const [decrypted, setDecrypted] = useState<{ for: string; text: string } | null>(null);

  useEffect(() => {
    if (!encryptionVersion || !me?._id || !me.publicKey) return;
    let cancelled = false;
    (async () => {
      const own = await loadOwnKey(String(me._id), me.publicKey!);
      if (!own) throw new Error("This browser isn't linked");
      if (encryptionVersion === "asymmetric" && partnerPublicKey) {
        return EncryptionService.decryptMessageAsymmetric(
          text,
          own.privateKey,
          own.publicKey,
          await EncryptionService.importPublicKeyFromJWK(partnerPublicKey)
        );
      }
      if (encryptionVersion === "teamKey" && wrappedTeamKey) {
        if (!teamKeyCache.has(wrappedTeamKey)) {
          teamKeyCache.set(wrappedTeamKey, EncryptionService.unwrapTeamKey(wrappedTeamKey, own.privateKey));
        }
        return EncryptionService.decryptMessage(text, await teamKeyCache.get(wrappedTeamKey)!);
      }
      throw new Error("Can't decrypt this message here");
    })()
      .catch(() => LOCKED)
      .then((result) => {
        if (!cancelled) setDecrypted({ for: text, text: result });
      });
    return () => {
      cancelled = true;
    };
  }, [text, encryptionVersion, partnerPublicKey, wrappedTeamKey, me?._id, me?.publicKey]);

  if (!encryptionVersion) return <>{text}</>;
  return <>{decrypted?.for === text ? decrypted.text : LOCKED}</>;
}
