"use client";

import { useState, useEffect, useCallback } from "react";
import { EncryptionService } from "@/lib/encryption";

interface UseEncryptionReturn {
  encryptMessage: (text: string) => Promise<string>;
  decryptMessage: (encryptedText: string, isEncrypted: boolean) => Promise<string>;
  isEncryptionReady: boolean;
  isEncryptionAvailable: boolean;
  encryptionError: string | null;
}

/**
 * Hook for managing end-to-end encryption in chat components
 * Uses conversation slug (for individual chats) or team slug (for team chats)
 * to derive encryption keys, allowing messages to be decrypted across devices.
 * 
 * @param options - Either conversationSlug (for individual chats) or teamSlug (for team chats)
 * @returns Encryption functions and state
 */
export function useEncryptionWithUser({
  conversationSlug,
  teamSlug,
}: {
  conversationSlug?: string;
  teamSlug?: string;
}): UseEncryptionReturn {
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const isEncryptionAvailable = EncryptionService.isEncryptionAvailable();

  // Initialize encryption key from slug
  useEffect(() => {
    let cancelled = false;

    const initializeKey = async () => {
      if (!isEncryptionAvailable) {
        setIsEncryptionReady(false);
        setEncryptionError("Encryption is not available in this browser");
        return;
      }

      // Need either conversationSlug or teamSlug
      const slug = teamSlug || conversationSlug;
      if (!slug) {
        setIsEncryptionReady(false);
        return;
      }

      try {
        setEncryptionError(null);
        let key: CryptoKey;

        if (teamId) {
          // Team chat encryption
          // Convert Convex ID to string explicitly to ensure consistent key derivation
          key = await EncryptionService.getOrCreateTeamKey(String(teamId));
        } else if (otherUserId && currentUserId) {
          // Individual chat encryption
          // Convert Convex IDs to strings explicitly to ensure consistent key derivation
          // This ensures the same key is generated on all devices for the same conversation
          const currentUserIdStr = String(currentUserId);
          const otherUserIdStr = String(otherUserId);
          
          if (!currentUserIdStr || !otherUserIdStr) {
            setIsEncryptionReady(false);
            setEncryptionError("User IDs are required for encryption");
            return;
          }
          
          key = await EncryptionService.getOrCreateConversationKey(
            currentUserIdStr,
            otherUserIdStr
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
  }, [conversationSlug, teamSlug, isEncryptionAvailable]);

  /**
   * Encrypt a message before sending
   */
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

  /**
   * Decrypt a message after receiving
   */
  const decryptMessage = useCallback(
    async (encryptedText: string, isEncrypted: boolean): Promise<string> => {
      // If message is not encrypted, return as-is
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
