"use client";

import { useState, useEffect, useCallback } from "react";
import { EncryptionService } from "@/lib/encryption";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface UseEncryptionOptions {
  otherUserId?: Id<"users">;
  teamId?: Id<"teams">;
}

interface UseEncryptionReturn {
  encryptMessage: (text: string, encryptionVersion?: "symmetric" | "asymmetric") => Promise<string>;
  decryptMessage: (encryptedText: string, isEncrypted: boolean, encryptionVersion?: "symmetric" | "asymmetric") => Promise<string>;
  isEncryptionReady: boolean;
  isEncryptionAvailable: boolean;
  encryptionError: string | null;
}

/**
 * Hook for managing end-to-end encryption in chat components (LEGACY)
 * @deprecated Use useEncryptionWithUser instead
 */
export function useEncryption({
  otherUserId,
  teamId,
}: UseEncryptionOptions): UseEncryptionReturn {
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const isEncryptionAvailable = EncryptionService.isEncryptionAvailable();

  // Initialize encryption key (legacy symmetric)
  useEffect(() => {
    let cancelled = false;

    const initializeKey = async () => {
      if (!isEncryptionAvailable) {
        setIsEncryptionReady(false);
        setEncryptionError("Encryption is not available in this browser");
        return;
      }

      try {
        setEncryptionError(null);
        let key: CryptoKey;

        if (teamId) {
          key = await EncryptionService.getOrCreateTeamKey(String(teamId));
        } else if (otherUserId) {
          key = await EncryptionService.getOrCreateConversationKey(
            "current_user",
            String(otherUserId)
          );
        } else {
          setIsEncryptionReady(false);
          return;
        }

        if (!cancelled) {
          setConversationKey(key);
          setIsEncryptionReady(true);
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

    initializeKey();

    return () => {
      cancelled = true;
    };
  }, [otherUserId, teamId, isEncryptionAvailable]);

  const encryptMessage = useCallback(
    async (text: string): Promise<string> => {
      if (!isEncryptionAvailable) {
        throw new Error("Encryption is not available");
      }

      if (!conversationKey) {
        throw new Error("Encryption key not ready");
      }

      try {
        return await EncryptionService.encryptMessage(text, conversationKey);
      } catch (error) {
        throw new Error(
          `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [conversationKey, isEncryptionAvailable]
  );

  const decryptMessage = useCallback(
    async (encryptedText: string, isEncrypted: boolean): Promise<string> => {
      if (!isEncrypted) {
        return encryptedText;
      }

      if (!isEncryptionAvailable) {
        throw new Error("Encryption is not available - cannot decrypt message");
      }

      if (!conversationKey) {
        throw new Error("Encryption key not ready - cannot decrypt message");
      }

      try {
        return await EncryptionService.decryptMessage(encryptedText, conversationKey);
      } catch (error) {
        throw new Error(
          `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [conversationKey, isEncryptionAvailable]
  );

  return {
    encryptMessage,
    decryptMessage,
    isEncryptionReady,
    isEncryptionAvailable,
    encryptionError,
  };
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
  const [teamPublicKey, setTeamPublicKey] = useState<CryptoKey | null>(null);
  const isEncryptionAvailable = EncryptionService.isEncryptionAvailable();

  // Fetch receiver's public key from database
  const receiverPublicKeyJWK = useQuery(
    api.users.getUserPublicKey,
    otherUserId ? { userId: otherUserId } : "skip"
  );

  // Fetch team's public key from database
  const teamPublicKeyJWK = useQuery(
    api.teams.getTeamPublicKey,
    teamId ? { teamId } : "skip"
  );

  // Mutation to set user's public key
  const setUserPublicKeyMutation = useMutation(api.users.setUserPublicKey);

  // Mutation to set team's public key
  const setTeamPublicKeyMutation = useMutation(api.teams.setTeamPublicKey);

  // Initialize user's private key pair and fetch receiver's public key
  useEffect(() => {
    let cancelled = false;

    const initializeEncryption = async () => {
      if (!isEncryptionAvailable) {
        setIsEncryptionReady(false);
        setEncryptionError("Encryption is not available in this browser");
        return;
      }

      if (!currentUserId) {
        setIsEncryptionReady(false);
        return;
      }

      try {
        setEncryptionError(null);

        // Generate or load user's private key pair
        const keyPair = await EncryptionService.getOrCreateUserKeyPair(String(currentUserId));
        
        // Export and upload public key to database if not already there
        const publicKeyJWK = await EncryptionService.exportPublicKeyAsJWK(keyPair);
        
        // Upload public key (this is idempotent - won't fail if already exists)
        try {
          await setUserPublicKeyMutation({ publicKey: publicKeyJWK });
        } catch (error) {
          // Ignore errors if key already exists or user doesn't have permission
          console.warn("Failed to upload public key:", error);
        }

        if (!cancelled) {
          setUserKeyPair(keyPair);
        }

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

        // For team chats: fetch team's public key or generate it
        if (teamId) {
          if (teamPublicKeyJWK) {
            try {
              const teamKey = await EncryptionService.importPublicKeyFromJWK(teamPublicKeyJWK);
              if (!cancelled) {
                setTeamPublicKey(teamKey);
                setIsEncryptionReady(true);
              }
            } catch (error) {
              if (!cancelled) {
                setEncryptionError(
                  `Failed to import team's public key: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                setIsEncryptionReady(false);
              }
            }
          } else if (teamPublicKeyJWK === null) {
            // Team doesn't have a public key yet - generate one
            try {
              const teamKeyPair = await EncryptionService.getOrCreateTeamKeyPair(String(teamId));
              const teamPublicKeyJWK = await EncryptionService.exportPublicKeyAsJWK(teamKeyPair);
              
              // Upload team public key
              try {
                await setTeamPublicKeyMutation({ teamId, publicKey: teamPublicKeyJWK });
                const teamKey = await EncryptionService.importPublicKeyFromJWK(teamPublicKeyJWK);
                if (!cancelled) {
                  setTeamPublicKey(teamKey);
                  setIsEncryptionReady(true);
                }
              } catch (error) {
                console.warn("Failed to upload team public key:", error);
                // Still use the key locally
                if (!cancelled) {
                  setTeamPublicKey(teamKeyPair.publicKey);
                  setIsEncryptionReady(true);
                }
              }
            } catch (error) {
              if (!cancelled) {
                setEncryptionError(
                  `Failed to generate team key pair: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                setIsEncryptionReady(false);
              }
            }
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
    teamPublicKeyJWK,
    setUserPublicKeyMutation,
    setTeamPublicKeyMutation,
  ]);

  /**
   * Encrypt a message before sending
   * Uses asymmetric encryption with receiver's public key
   */
  const encryptMessage = useCallback(
    async (text: string, encryptionVersion: "symmetric" | "asymmetric" = "asymmetric"): Promise<string> => {
      if (!isEncryptionAvailable) {
        throw new Error("Encryption is not available");
      }

      // Use legacy symmetric encryption if requested (for backward compatibility)
      if (encryptionVersion === "symmetric") {
        if (!currentUserId || (!otherUserId && !teamId)) {
          throw new Error("User IDs required for symmetric encryption");
        }
        const key = teamId
          ? await EncryptionService.getOrCreateTeamKey(String(teamId))
          : await EncryptionService.getOrCreateConversationKey(String(currentUserId), String(otherUserId!));
        return await EncryptionService.encryptMessage(text, key);
      }

      // Asymmetric encryption
      if (!userKeyPair) {
        throw new Error("Encryption key pair not ready");
      }

      const publicKey = teamId ? teamPublicKey : receiverPublicKey;
      if (!publicKey) {
        throw new Error("Receiver's public key not available");
      }

      try {
        return await EncryptionService.encryptMessageAsymmetric(text, publicKey);
      } catch (error) {
        throw new Error(
          `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [userKeyPair, receiverPublicKey, teamPublicKey, isEncryptionAvailable, currentUserId, otherUserId, teamId]
  );

  /**
   * Decrypt a message after receiving
   * Uses asymmetric decryption with user's private key
   */
  const decryptMessage = useCallback(
    async (
      encryptedText: string,
      isEncrypted: boolean,
      encryptionVersion: "symmetric" | "asymmetric" = "asymmetric"
    ): Promise<string> => {
      // If message is not encrypted, return as-is
      if (!isEncrypted) {
        return encryptedText;
      }

      if (!isEncryptionAvailable) {
        throw new Error("Encryption is not available - cannot decrypt message");
      }

      // Use legacy symmetric decryption if requested (for backward compatibility)
      if (encryptionVersion === "symmetric") {
        if (!currentUserId || (!otherUserId && !teamId)) {
          throw new Error("Cannot decrypt: Missing user IDs");
        }
        const key = teamId
          ? await EncryptionService.getOrCreateTeamKey(String(teamId))
          : await EncryptionService.getOrCreateConversationKey(String(currentUserId), String(otherUserId!));
        return await EncryptionService.decryptMessage(encryptedText, key);
      }

      // Asymmetric decryption
      if (!userKeyPair) {
        throw new Error("Encryption key pair not ready - cannot decrypt message");
      }

      try {
        return await EncryptionService.decryptMessageAsymmetric(encryptedText, userKeyPair.privateKey);
      } catch (error) {
        // Try legacy symmetric decryption as fallback
        try {
          if (currentUserId && (otherUserId || teamId)) {
            const key = teamId
              ? await EncryptionService.getOrCreateTeamKey(String(teamId))
              : await EncryptionService.getOrCreateConversationKey(String(currentUserId), String(otherUserId!));
            return await EncryptionService.decryptMessage(encryptedText, key);
          }
        } catch {
          // Both failed
        }

        throw new Error(
          `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [userKeyPair, isEncryptionAvailable, currentUserId, otherUserId, teamId]
  );

  return {
    encryptMessage,
    decryptMessage,
    isEncryptionReady,
    isEncryptionAvailable,
    encryptionError,
  };
}
