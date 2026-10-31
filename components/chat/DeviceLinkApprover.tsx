"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EncryptionService } from "@/lib/encryption";
import { extractErrorMessage } from "@/lib/errors";

/** On browsers that hold the chat key: approve another browser of the same account asking for it */
export function DeviceLinkApprover() {
  const me = useQuery(api.users.current);
  const pending = useQuery(api.users.getPendingDeviceLinks);
  const approve = useMutation(api.users.approveDeviceLink);
  const deny = useMutation(api.users.deleteDeviceLink);
  const [ownKey, setOwnKey] = useState<CryptoKeyPair | null>(null);
  const [linkCode, setLinkCode] = useState<{ forKey: string; code: string } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only a browser whose key is the account's current key can hand it out
  useEffect(() => {
    if (!me?._id || !me.publicKey || !EncryptionService.isEncryptionAvailable()) return;
    let cancelled = false;
    (async () => {
      const local = await EncryptionService.loadKeyPair(EncryptionService.userKeyName(String(me._id)));
      const matches =
        !!local &&
        EncryptionService.samePublicKey(await EncryptionService.exportPublicKeyAsJWK(local), me.publicKey!);
      if (!cancelled) setOwnKey(matches ? local : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [me?._id, me?.publicKey]);

  const request = ownKey ? pending?.find((p) => p._id !== dismissed) : undefined;

  const requestKey = request?.tempPublicKey;
  useEffect(() => {
    if (requestKey) EncryptionService.linkCode(requestKey).then((code) => setLinkCode({ forKey: requestKey, code }));
  }, [requestKey]);
  const code = linkCode?.forKey === requestKey ? linkCode?.code : null;

  if (!request || !ownKey) return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      const privateJWK = JSON.stringify(await crypto.subtle.exportKey("jwk", ownKey.privateKey));
      const payload = await EncryptionService.encryptMessageAsymmetric(
        privateJWK,
        await EncryptionService.importPublicKeyFromJWK(request.tempPublicKey),
        ownKey
      );
      await approve({ linkId: request._id, payload });
      toast.success("Browser linked");
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDeny = async () => {
    setBusy(true);
    await deny({ linkId: request._id }).catch(() => {});
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && setDismissed(request._id)}>
      <DialogContent className="sm:max-w-md">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <MonitorSmartphone className="size-5" aria-hidden="true" />
        </span>
        <DialogHeader>
          <DialogTitle>Link a new browser?</DialogTitle>
          <DialogDescription>
            Another browser signed in to your account wants access to your encrypted chats. Only approve if
            it&apos;s you, and the code there matches this one.
          </DialogDescription>
        </DialogHeader>
        <p className="text-center font-mono text-2xl tracking-[0.3em]">
          {code ? `${code.slice(0, 3)} ${code.slice(3)}` : "…"}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={handleDeny} disabled={busy}>
            Deny
          </Button>
          <Button onClick={handleApprove} disabled={busy}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
