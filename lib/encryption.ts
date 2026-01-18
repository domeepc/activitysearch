/**
 * End-to-End Encryption Service
 * Uses Web Crypto API with AES-GCM-256 for message encryption
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits for authentication tag

/**
 * Encryption Service for E2E message encryption
 */
export class EncryptionService {
  /**
   * Generate a new AES-GCM encryption key
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

      // Decode from base64
      const iv = this.base64ToArrayBuffer(ivBase64);
      const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
      const tag = this.base64ToArrayBuffer(tagBase64);

      // Combine ciphertext and tag for GCM decryption
      const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(new Uint8Array(ciphertext), 0);
      combined.set(new Uint8Array(tag), ciphertext.byteLength);

      // Decrypt
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
   * Derive an encryption key from a conversation or team slug using PBKDF2
   * This ensures the same slug always produces the same key, allowing
   * messages to be decrypted across different devices.
   */
  static async deriveKeyFromSlug(slug: string): Promise<CryptoKey> {
    // Convert slug to ArrayBuffer
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(slug);

    // Use a fixed application-wide salt
    // This salt should remain constant across all devices and versions
    const salt = encoder.encode("activitysearch-e2e-salt-v1");

    // Import password as key material for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordData,
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    // Derive key using PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      {
        name: ALGORITHM, // "AES-GCM"
        length: KEY_LENGTH, // 256
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Check if encryption is available (Web Crypto API)
   */
  static isEncryptionAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    if (!window.crypto || !window.crypto.subtle) {
      return false;
    }

    return true;
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
