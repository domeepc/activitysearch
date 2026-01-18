/**
 * End-to-End Encryption Service
 * Uses ECDH (Elliptic Curve Diffie-Hellman) with AES-GCM for hybrid encryption
 * Each user has their own key pair (public/private)
 * Messages are encrypted with receiver's public key and decrypted with receiver's private key
 * 
 * Backward compatibility: Old symmetric encryption methods are preserved for legacy messages
 */

// ECDH Configuration
const ECDH_CURVE = "P-256";
const ECDH_ALGORITHM = "ECDH";

// AES-GCM Configuration (used for hybrid encryption)
const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits for authentication tag

// HKDF Configuration (for deriving AES keys from shared secrets)
const HKDF_ALGORITHM = "HKDF";
const HKDF_HASH = "SHA-256";
const HKDF_SALT = new TextEncoder().encode("activitysearch_hkdf_salt_v1");
const HKDF_INFO = new TextEncoder().encode("activitysearch_aes_key_v1");

// Legacy symmetric encryption constants (for backward compatibility)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT = "activitysearch_e2e_salt_v1";

/**
 * Encryption Service for E2E message encryption
 */
export class EncryptionService {
  /**
   * Generate an ECDH key pair for a user
   */
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: ECDH_ALGORITHM,
        namedCurve: ECDH_CURVE,
      },
      true, // extractable
      ["deriveKey", "deriveBits"]
    );
  }

  /**
   * Get or create user's private key pair
   * Private key is stored in localStorage
   */
  static async getOrCreateUserKeyPair(userId: string): Promise<CryptoKeyPair> {
    const keyName = `ecdh_private_key_${userId}`;

    // Try to load from localStorage
    const cachedKeyPair = await this.loadKeyPair(keyName);
    if (cachedKeyPair) {
      return cachedKeyPair;
    }

    // Generate new key pair
    const keyPair = await this.generateKeyPair();

    // Store private key in localStorage (public key will be stored in database)
    await this.storeKeyPair(keyName, keyPair);

    return keyPair;
  }

  /**
   * Get or create team's private key pair
   */
  static async getOrCreateTeamKeyPair(teamId: string): Promise<CryptoKeyPair> {
    const keyName = `ecdh_team_private_key_${teamId}`;

    // Try to load from localStorage
    const cachedKeyPair = await this.loadKeyPair(keyName);
    if (cachedKeyPair) {
      return cachedKeyPair;
    }

    // Generate new key pair
    const keyPair = await this.generateKeyPair();

    // Store private key in localStorage
    await this.storeKeyPair(keyName, keyPair);

    return keyPair;
  }

  /**
   * Import a public key from JWK string
   */
  static async importPublicKeyFromJWK(jwkString: string): Promise<CryptoKey> {
    try {
      const jwk = JSON.parse(jwkString);
      return await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
          name: ECDH_ALGORITHM,
          namedCurve: ECDH_CURVE,
        },
        false, // not extractable
        []
      );
    } catch (error) {
      throw new Error(`Failed to import public key: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Export public key as JWK string
   */
  static async exportPublicKeyAsJWK(keyPair: CryptoKeyPair): Promise<string> {
    const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    return JSON.stringify(jwk);
  }

  /**
   * Derive AES-GCM key from ECDH shared secret
   */
  private static async deriveAESKeyFromSharedSecret(
    sharedSecret: ArrayBuffer
  ): Promise<CryptoKey> {
    // Import shared secret as HKDF key material
    const hkdfKey = await crypto.subtle.importKey(
      "raw",
      sharedSecret,
      HKDF_ALGORITHM,
      false,
      ["deriveKey"]
    );

    // Derive AES-GCM key using HKDF
    return await crypto.subtle.deriveKey(
      {
        name: HKDF_ALGORITHM,
        hash: HKDF_HASH,
        salt: HKDF_SALT,
        info: HKDF_INFO,
      },
      hkdfKey,
      {
        name: AES_ALGORITHM,
        length: AES_KEY_LENGTH,
      },
      false, // not extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt a message using receiver's public key (asymmetric encryption)
   * Format: base64(ephemeralPublicKey):base64(iv):base64(ciphertext):base64(tag)
   */
  static async encryptMessageAsymmetric(
    text: string,
    receiverPublicKey: CryptoKey
  ): Promise<string> {
    // Generate ephemeral key pair for this message
    const ephemeralKeyPair = await this.generateKeyPair();

    // Derive shared secret using ECDH
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: ECDH_ALGORITHM,
        public: receiverPublicKey,
      },
      ephemeralKeyPair.privateKey,
      256 // 256 bits
    );

    // Derive AES-GCM key from shared secret
    const aesKey = await this.deriveAESKeyFromSharedSecret(sharedSecret);

    // Encrypt message with AES-GCM
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: AES_ALGORITHM,
        iv: iv,
        tagLength: TAG_LENGTH,
      },
      aesKey,
      data
    );

    // Extract ciphertext and tag
    const ciphertextLength = encrypted.byteLength - TAG_LENGTH / 8;
    const ciphertext = new Uint8Array(encrypted, 0, ciphertextLength);
    const tag = new Uint8Array(encrypted, ciphertextLength);

    // Export ephemeral public key as JWK
    const ephemeralPublicKeyJWK = await crypto.subtle.exportKey("jwk", ephemeralKeyPair.publicKey);
    const ephemeralPublicKeyBase64 = this.arrayBufferToBase64(
      new TextEncoder().encode(JSON.stringify(ephemeralPublicKeyJWK))
    );

    // Convert to base64
    const ivBase64 = this.arrayBufferToBase64(iv);
    const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);
    const tagBase64 = this.arrayBufferToBase64(tag);

    // Return format: ephemeralPublicKey:iv:ciphertext:tag
    return `${ephemeralPublicKeyBase64}:${ivBase64}:${ciphertextBase64}:${tagBase64}`;
  }

  /**
   * Decrypt a message using user's private key (asymmetric decryption)
   * Expected format: base64(ephemeralPublicKey):base64(iv):base64(ciphertext):base64(tag)
   */
  static async decryptMessageAsymmetric(
    encryptedText: string,
    userPrivateKey: CryptoKey
  ): Promise<string> {
    try {
      // Parse the encrypted message
      const parts = encryptedText.split(":");
      if (parts.length !== 4) {
        throw new Error("Invalid encrypted message format");
      }

      const [ephemeralPublicKeyBase64, ivBase64, ciphertextBase64, tagBase64] = parts;

      // Validate that all parts are non-empty
      if (!ephemeralPublicKeyBase64 || !ivBase64 || !ciphertextBase64 || !tagBase64) {
        throw new Error("Invalid encrypted message format: missing parts");
      }

      // Import ephemeral public key
      const ephemeralPublicKeyJWKString = new TextDecoder().decode(
        this.base64ToArrayBuffer(ephemeralPublicKeyBase64)
      );
      const ephemeralPublicKey = await this.importPublicKeyFromJWK(ephemeralPublicKeyJWKString);

      // Derive shared secret using ECDH
      const sharedSecret = await crypto.subtle.deriveBits(
        {
          name: ECDH_ALGORITHM,
          public: ephemeralPublicKey,
        },
        userPrivateKey,
        256 // 256 bits
      );

      // Derive AES-GCM key from shared secret
      const aesKey = await this.deriveAESKeyFromSharedSecret(sharedSecret);

      // Decode IV, ciphertext, and tag
      const ivBuffer = this.base64ToArrayBuffer(ivBase64);
      const iv = new Uint8Array(ivBuffer);

      if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
      }

      const ciphertextBuffer = this.base64ToArrayBuffer(ciphertextBase64);
      const ciphertext = new Uint8Array(ciphertextBuffer);
      const tagBuffer = this.base64ToArrayBuffer(tagBase64);
      const tag = new Uint8Array(tagBuffer);

      if (tag.length !== TAG_LENGTH / 8) {
        throw new Error(`Invalid tag length: expected ${TAG_LENGTH / 8} bytes, got ${tag.length}`);
      }

      // Combine ciphertext and tag for GCM decryption
      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.length);

      // Decrypt
      let decrypted: ArrayBuffer;
      try {
        decrypted = await crypto.subtle.decrypt(
          {
            name: AES_ALGORITHM,
            iv: iv,
            tagLength: TAG_LENGTH,
          },
          aesKey,
          combined
        );
      } catch (cryptoError) {
        const errorMsg = cryptoError instanceof Error ? cryptoError.message : "Unknown error";
        if (errorMsg.includes("operation failed") || errorMsg.includes("operation-specific")) {
          throw new Error(
            "Decryption failed: The encryption key does not match. This usually means the message was encrypted with a different key."
          );
        }
        throw cryptoError;
      }

      // Convert to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Decryption failed:")) {
        throw error;
      }
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Store a key pair in localStorage
   */
  static async storeKeyPair(keyName: string, keyPair: CryptoKeyPair): Promise<void> {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        throw new Error("localStorage is not available");
      }

      // Export private key as JWK
      const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
      const keyData = JSON.stringify(jwk);

      // Store in localStorage
      localStorage.setItem(keyName, keyData);
    } catch (error) {
      throw new Error(`Failed to store key pair: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Load a key pair from localStorage
   * Note: Only private key is stored, public key is derived from it
   */
  static async loadKeyPair(keyName: string): Promise<CryptoKeyPair | null> {
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

      // Import private key
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
          name: ECDH_ALGORITHM,
          namedCurve: ECDH_CURVE,
        },
        true, // extractable
        ["deriveKey", "deriveBits"]
      );

      // Derive public key from private key
      // For ECDH, we need to generate a temporary key pair to extract the public key
      // Actually, JWK format includes both public and private key material
      // Let's check if we can extract public key from the JWK
      if (jwk.x && jwk.y) {
        // We have public key coordinates, import it
        const publicKeyJWK = {
          kty: jwk.kty,
          crv: jwk.crv,
          x: jwk.x,
          y: jwk.y,
        };
        const publicKey = await crypto.subtle.importKey(
          "jwk",
          publicKeyJWK,
          {
            name: ECDH_ALGORITHM,
            namedCurve: ECDH_CURVE,
          },
          false,
          []
        );

        return { privateKey, publicKey };
      }

      // If we don't have public key coordinates, we need to generate a new pair
      // This shouldn't happen with proper JWK format, but handle it gracefully
      console.warn("Public key not found in stored JWK, generating new key pair");
      return null;
    } catch (error) {
      console.error(`Failed to load key pair ${keyName}:`, error);
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

  // ========== Legacy Symmetric Encryption Methods (for backward compatibility) ==========

  /**
   * Derive an AES-GCM encryption key from user IDs using PBKDF2 (LEGACY)
   * @deprecated Use asymmetric encryption instead
   */
  static async deriveKeyFromIds(user1Id: string, user2Id: string): Promise<CryptoKey> {
    const sortedIds = [user1Id, user2Id].sort((a, b) => a.localeCompare(b));
    const keyMaterial = `${sortedIds[0]}_${sortedIds[1]}`;

    const encoder = new TextEncoder();
    const keyMaterialBuffer = encoder.encode(keyMaterial);
    const saltBuffer = encoder.encode(PBKDF2_SALT);

    const baseKey = await crypto.subtle.importKey(
      "raw",
      keyMaterialBuffer,
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      AES_KEY_LENGTH
    );

    return await crypto.subtle.importKey(
      "raw",
      derivedBits,
      {
        name: AES_ALGORITHM,
        length: AES_KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Derive an AES-GCM encryption key from team ID using PBKDF2 (LEGACY)
   * @deprecated Use asymmetric encryption instead
   */
  static async deriveKeyFromTeamId(teamId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterialBuffer = encoder.encode(teamId);
    const saltBuffer = encoder.encode(PBKDF2_SALT);

    const baseKey = await crypto.subtle.importKey(
      "raw",
      keyMaterialBuffer,
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      AES_KEY_LENGTH
    );

    return await crypto.subtle.importKey(
      "raw",
      derivedBits,
      {
        name: AES_ALGORITHM,
        length: AES_KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt a message using symmetric AES-GCM (LEGACY)
   * @deprecated Use encryptMessageAsymmetric instead
   */
  static async encryptMessage(text: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: AES_ALGORITHM,
        iv: iv,
        tagLength: TAG_LENGTH,
      },
      key,
      data
    );

    const ciphertextLength = encrypted.byteLength - TAG_LENGTH / 8;
    const ciphertext = new Uint8Array(encrypted, 0, ciphertextLength);
    const tag = new Uint8Array(encrypted, ciphertextLength);

    const ivBase64 = this.arrayBufferToBase64(iv);
    const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);
    const tagBase64 = this.arrayBufferToBase64(tag);

    return `${ivBase64}:${ciphertextBase64}:${tagBase64}`;
  }

  /**
   * Decrypt a message using symmetric AES-GCM (LEGACY)
   * @deprecated Use decryptMessageAsymmetric instead
   */
  static async decryptMessage(encryptedText: string, key: CryptoKey): Promise<string> {
    try {
      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted message format");
      }

      const [ivBase64, ciphertextBase64, tagBase64] = parts;

      if (!ivBase64 || !ciphertextBase64 || !tagBase64) {
        throw new Error("Invalid encrypted message format: missing parts");
      }

      const ivBuffer = this.base64ToArrayBuffer(ivBase64);
      const iv = new Uint8Array(ivBuffer);

      if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
      }

      const ciphertextBuffer = this.base64ToArrayBuffer(ciphertextBase64);
      const ciphertext = new Uint8Array(ciphertextBuffer);
      const tagBuffer = this.base64ToArrayBuffer(tagBase64);
      const tag = new Uint8Array(tagBuffer);

      if (tag.length !== TAG_LENGTH / 8) {
        throw new Error(`Invalid tag length: expected ${TAG_LENGTH / 8} bytes, got ${tag.length}`);
      }

      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.length);

      let decrypted: ArrayBuffer;
      try {
        decrypted = await crypto.subtle.decrypt(
          {
            name: AES_ALGORITHM,
            iv: iv,
            tagLength: TAG_LENGTH,
          },
          key,
          combined
        );
      } catch (cryptoError) {
        const errorMsg = cryptoError instanceof Error ? cryptoError.message : "Unknown error";
        if (errorMsg.includes("operation failed") || errorMsg.includes("operation-specific")) {
          throw new Error(
            "Decryption failed: The encryption key does not match. This usually means the message was encrypted with a different key, or the key derivation failed."
          );
        }
        throw cryptoError;
      }

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Decryption failed:")) {
        throw error;
      }
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Get or create encryption key for a conversation (LEGACY)
   * @deprecated Use asymmetric encryption instead
   */
  static async getOrCreateConversationKey(
    user1Id: string,
    user2Id: string
  ): Promise<CryptoKey> {
    const sortedIds = [user1Id, user2Id].sort((a, b) => a.localeCompare(b));
    const keyName = `e2e_key_${sortedIds[0]}_${sortedIds[1]}`;

    const cachedKey = await this.loadKey(keyName);
    if (cachedKey) {
      return cachedKey;
    }

    const derivedKey = await this.deriveKeyFromIds(user1Id, user2Id);
    await this.storeKey(keyName, derivedKey);
    return derivedKey;
  }

  /**
   * Get or create encryption key for a team (LEGACY)
   * @deprecated Use asymmetric encryption instead
   */
  static async getOrCreateTeamKey(teamId: string): Promise<CryptoKey> {
    const keyName = `e2e_team_key_${teamId}`;

    const cachedKey = await this.loadKey(keyName);
    if (cachedKey) {
      return cachedKey;
    }

    const derivedKey = await this.deriveKeyFromTeamId(teamId);
    await this.storeKey(keyName, derivedKey);
    return derivedKey;
  }

  /**
   * Store a key in localStorage as JWK (LEGACY)
   */
  static async storeKey(keyName: string, key: CryptoKey): Promise<void> {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        throw new Error("localStorage is not available");
      }

      const jwk = await crypto.subtle.exportKey("jwk", key);
      const keyData = JSON.stringify(jwk);
      localStorage.setItem(keyName, keyData);
    } catch (error) {
      throw new Error(`Failed to store key: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Load a key from localStorage (LEGACY)
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

      const jwk = JSON.parse(keyData);
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
          name: AES_ALGORITHM,
          length: AES_KEY_LENGTH,
        },
        true,
        ["encrypt", "decrypt"]
      );

      return key;
    } catch (error) {
      console.error(`Failed to load key ${keyName}:`, error);
      return null;
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
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      throw new Error(`Invalid base64 string: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
