/**
 * End-to-End Encryption Service
 * Uses Web Crypto API with AES-GCM-256 for message encryption
 * Keys are derived deterministically from user IDs to work across devices
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits for authentication tag
const PBKDF2_ITERATIONS = 100000; // High iteration count for security
const PBKDF2_SALT = "activitysearch_e2e_salt_v1"; // Fixed salt for deterministic key derivation

/**
 * Encryption Service for E2E message encryption
 */
export class EncryptionService {
  /**
   * Derive an AES-GCM encryption key from user IDs using PBKDF2
   * This ensures the same key is generated on all devices for the same conversation
   */
  static async deriveKeyFromIds(user1Id: string, user2Id: string): Promise<CryptoKey> {
    // Sort IDs to ensure consistent key derivation
    const sortedIds = [user1Id, user2Id].sort((a, b) => a.localeCompare(b));
    const keyMaterial = `${sortedIds[0]}_${sortedIds[1]}`;
    
    // Convert key material to ArrayBuffer
    const encoder = new TextEncoder();
    const keyMaterialBuffer = encoder.encode(keyMaterial);
    const saltBuffer = encoder.encode(PBKDF2_SALT);
    
    // Import key material for PBKDF2
    const baseKey = await crypto.subtle.importKey(
      "raw",
      keyMaterialBuffer,
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    
    // Derive key bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      KEY_LENGTH
    );
    
    // Import derived bits as AES-GCM key
    return await crypto.subtle.importKey(
      "raw",
      derivedBits,
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Derive an AES-GCM encryption key from team ID using PBKDF2
   */
  static async deriveKeyFromTeamId(teamId: string): Promise<CryptoKey> {
    // Convert team ID to ArrayBuffer
    const encoder = new TextEncoder();
    const keyMaterialBuffer = encoder.encode(teamId);
    const saltBuffer = encoder.encode(PBKDF2_SALT);
    
    // Import key material for PBKDF2
    const baseKey = await crypto.subtle.importKey(
      "raw",
      keyMaterialBuffer,
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    
    // Derive key bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      KEY_LENGTH
    );
    
    // Import derived bits as AES-GCM key
    return await crypto.subtle.importKey(
      "raw",
      derivedBits,
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Generate a new AES-GCM encryption key (kept for backward compatibility)
   * @deprecated Use deriveKeyFromIds or deriveKeyFromTeamId instead
   */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt a message using the provided key
   * Returns: base64(iv):base64(ciphertext):base64(tag)
   */
  static async encryptMessage(
    text: string,
    key: CryptoKey
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Generate random IV for each message
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt the message
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv,
        tagLength: TAG_LENGTH,
      },
      key,
      data
    );

    // Extract ciphertext and tag
    // In GCM mode, the tag is appended to the ciphertext
    const ciphertextLength = encrypted.byteLength - TAG_LENGTH / 8;
    const ciphertext = new Uint8Array(encrypted, 0, ciphertextLength);
    const tag = new Uint8Array(encrypted, ciphertextLength);

    // Convert to base64
    const ivBase64 = this.arrayBufferToBase64(iv);
    const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);
    const tagBase64 = this.arrayBufferToBase64(tag);

    // Return format: iv:ciphertext:tag
    return `${ivBase64}:${ciphertextBase64}:${tagBase64}`;
  }

  /**
   * Decrypt a message using the provided key
   * Expected format: base64(iv):base64(ciphertext):base64(tag)
   */
  static async decryptMessage(
    encryptedText: string,
    key: CryptoKey
  ): Promise<string> {
    try {
      // Parse the encrypted message
      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted message format");
      }

      const [ivBase64, ciphertextBase64, tagBase64] = parts;

      // Validate that all parts are non-empty
      if (!ivBase64 || !ciphertextBase64 || !tagBase64) {
        throw new Error("Invalid encrypted message format: missing parts");
      }

      // Decode from base64 and convert to Uint8Array
      const ivBuffer = this.base64ToArrayBuffer(ivBase64);
      const iv = new Uint8Array(ivBuffer);
      
      // Validate IV length
      if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
      }

      const ciphertextBuffer = this.base64ToArrayBuffer(ciphertextBase64);
      const ciphertext = new Uint8Array(ciphertextBuffer);
      const tagBuffer = this.base64ToArrayBuffer(tagBase64);
      const tag = new Uint8Array(tagBuffer);

      // Validate tag length
      if (tag.length !== TAG_LENGTH / 8) {
        throw new Error(`Invalid tag length: expected ${TAG_LENGTH / 8} bytes, got ${tag.length}`);
      }

      // Combine ciphertext and tag for GCM decryption
      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.length);

      // Decrypt - pass the Uint8Array directly (Web Crypto API accepts ArrayBufferView)
      const decrypted = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: iv,
          tagLength: TAG_LENGTH,
        },
        key,
        combined
      );

      // Convert to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Get or create encryption key for a conversation between two users
   * Keys are derived deterministically from user IDs to work across devices
   * localStorage is used as a cache for performance
   */
  static async getOrCreateConversationKey(
    user1Id: string,
    user2Id: string
  ): Promise<CryptoKey> {
    // Sort IDs to ensure consistent key derivation
    const sortedIds = [user1Id, user2Id].sort((a, b) => a.localeCompare(b));
    const keyName = `e2e_key_${sortedIds[0]}_${sortedIds[1]}`;

    // Try to load cached key from localStorage for performance
    const cachedKey = await this.loadKey(keyName);
    if (cachedKey) {
      return cachedKey;
    }

    // Derive key deterministically from user IDs
    // This ensures the same key is generated on all devices
    const derivedKey = await this.deriveKeyFromIds(user1Id, user2Id);
    
    // Cache the key in localStorage for performance
    await this.storeKey(keyName, derivedKey);
    
    return derivedKey;
  }

  /**
   * Get or create encryption key for a team
   * Keys are derived deterministically from team ID to work across devices
   * localStorage is used as a cache for performance
   */
  static async getOrCreateTeamKey(teamId: string): Promise<CryptoKey> {
    const keyName = `e2e_team_key_${teamId}`;

    // Try to load cached key from localStorage for performance
    const cachedKey = await this.loadKey(keyName);
    if (cachedKey) {
      return cachedKey;
    }

    // Derive key deterministically from team ID
    // This ensures the same key is generated on all devices
    const derivedKey = await this.deriveKeyFromTeamId(teamId);
    
    // Cache the key in localStorage for performance
    await this.storeKey(keyName, derivedKey);
    
    return derivedKey;
  }

  /**
   * Store a key in localStorage as JWK (JSON Web Key)
   */
  static async storeKey(keyName: string, key: CryptoKey): Promise<void> {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        throw new Error("localStorage is not available");
      }

      // Export key as JWK
      const jwk = await crypto.subtle.exportKey("jwk", key);
      const keyData = JSON.stringify(jwk);

      // Store in localStorage
      localStorage.setItem(keyName, keyData);
    } catch (error) {
      throw new Error(`Failed to store key: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Load a key from localStorage
   */
  static async loadKey(keyName: string): Promise<CryptoKey | null> {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return null;
      }

      const keyData = localStorage.getItem(keyName);
      if (!keyData) {
        return null;
      }

      // Parse JWK
      const jwk = JSON.parse(keyData);

      // Import key
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
          name: ALGORITHM,
          length: KEY_LENGTH,
        },
        true, // extractable
        ["encrypt", "decrypt"]
      );

      return key;
    } catch (error) {
      console.error(`Failed to load key ${keyName}:`, error);
      return null;
    }
  }

  /**
   * Check if encryption is available (Web Crypto API and localStorage)
   */
  static isEncryptionAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    if (!window.crypto || !window.crypto.subtle) {
      return false;
    }

    try {
      if (!window.localStorage) {
        return false;
      }
      // Test localStorage
      const testKey = "__encryption_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
