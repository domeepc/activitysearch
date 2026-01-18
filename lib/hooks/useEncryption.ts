"use client";

import { useState, useEffect, useCallback } from "react";
import { EncryptionService } from "@/lib/encryption";
import { Id } from "@/convex/_generated/dataModel";

interface UseEncryptionOptions {
  otherUserId?: Id<"users">;
  teamId?: Id<"teams">;
}

interface UseEncryptionReturn {
  encryptMessage: (text: string) => Promise<string>;
  decryptMessage: (encryptedText: string, isEncrypted: boolean) => Promise<string>;
  isEncryptionReady: boolean;
  isEncryptionAvailable: boolean;
  encryptionError: string | null;
}

/**
 * Hook for managing end-to-end encryption in chat components
 * 
 * @param options - Either otherUserId (for individual chats) or teamId (for team chats)
 * @returns Encryption functions and state
 */
export function useEncryption({
  otherUserId,
  teamId,
}: UseEncryptionOptions): UseEncryptionReturn {
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const isEncryptionAvailable = EncryptionService.isEncryptionAvailable();

  // Initialize encryption key
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
          // Team chat encryption
          key = await EncryptionService.getOrCreateTeamKey(teamId);
        } else if (otherUserId) {
          // Individual chat encryption - we need current user ID
          // For now, we'll get it from the key name pattern
          // The key will be created/retrieved when we have both user IDs
          // We'll need to get current user ID from context or props
          // For now, we'll initialize with a placeholder and update when we have current user
          key = await EncryptionService.getOrCreateConversationKey(
            "current_user", // This will be replaced with actual user ID
            otherUserId
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

/**
 * Hook variant that accepts current user ID for individual chats
 * This is needed because we need both user IDs to generate the correct key
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
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const isEncryptionAvailable = EncryptionService.isEncryptionAvailable();

  // Initialize encryption key
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
  }, [currentUserId, otherUserId, teamId, isEncryptionAvailable]);

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
