"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EncryptionService } from "@/lib/encryption";

interface SecurityCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  ownUserId: string;
  ownPublicKey: CryptoKey | null;
  otherUserId: string;
  otherPublicKeyJWK: string | null;
}

export function SecurityCodeDialog({
  open,
  onOpenChange,
  contactName,
  ownUserId,
  ownPublicKey,
  otherUserId,
  otherPublicKeyJWK,
}: SecurityCodeDialogProps) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ownPublicKey || !otherPublicKeyJWK) return;
    let cancelled = false;
    (async () => {
      const ownJWK = JSON.stringify(await crypto.subtle.exportKey("jwk", ownPublicKey));
      const result = await EncryptionService.securityCode(
        { userId: ownUserId, publicKeyJWK: ownJWK },
        { userId: otherUserId, publicKeyJWK: otherPublicKeyJWK }
      );
      if (!cancelled) setCode(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ownPublicKey, otherPublicKeyJWK, ownUserId, otherUserId]);

  const groups = code?.match(/\d{5}/g) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <DialogHeader>
          <DialogTitle>Verify security code</DialogTitle>
          <DialogDescription>
            Compare this number with the one on {contactName}&apos;s screen, in person or on a call. If they
            match, your messages are end-to-end encrypted and nobody is in the middle.
          </DialogDescription>
        </DialogHeader>
        {code ? (
          <p
            className="grid grid-cols-4 gap-x-4 gap-y-2 rounded-lg bg-muted p-4 text-center font-mono text-base tracking-wider"
            aria-label={`Security code: ${groups.join(" ")}`}
          >
            {groups.map((group, i) => (
              <span key={i}>{group}</span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ownPublicKey && otherPublicKeyJWK
              ? "Calculating…"
              : `A code is available once you and ${contactName} have both set up chat encryption.`}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
