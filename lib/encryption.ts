/**
 * End-to-End Encryption Service
 * 1:1 chats: ECDH (P-256) between the two users' keys -> HKDF -> AES-256-GCM.
 * Team chats: a random AES-256-GCM team key, wrapped for each member with the same ECDH scheme.
 * Each user has one key pair, shared between their linked browsers.
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

  /** localStorage slot for a user's private key on this browser */
  static userKeyName(userId: string): string {
    return `ecdh_private_key_${userId}`;
  }

  /** Same key if the public coordinates match (JWK field order differs between browsers) */
  static samePublicKey(a: string, b: string): boolean {
    const x = JSON.parse(a);
    const y = JSON.parse(b);
    return x.x === y.x && x.y === y.y;
  }

  /**
   * 60-digit security code for a 1:1 chat (Signal/WhatsApp style): 30 digits per person from
   * 5200 rounds of SHA-512 over their public key + user ID, ordered by user ID so both sides match.
   * Pass your OWN key from this browser, not the server's copy, or a key swap by the server goes unnoticed.
   */
  static async securityCode(
    a: { userId: string; publicKeyJWK: string },
    b: { userId: string; publicKeyJWK: string }
  ): Promise<string> {
    const half = async ({ userId, publicKeyJWK }: { userId: string; publicKeyJWK: string }) => {
      const { x, y } = JSON.parse(publicKeyJWK);
      const key = new TextEncoder().encode(`${x}.${y}`);
      const join = (p: Uint8Array, q: Uint8Array) => {
        const out = new Uint8Array(p.length + q.length);
        out.set(p);
        out.set(q, p.length);
        return out;
      };
      let hash = join(join(new Uint8Array([0]), key), new TextEncoder().encode(userId));
      for (let i = 0; i < 5200; i++) {
        hash = new Uint8Array(await crypto.subtle.digest("SHA-512", join(hash, key)));
      }
      let digits = "";
      for (let i = 0; i < 30; i += 5) {
        // 5 bytes = 40 bits, safely inside a JS number
        const chunk = hash.slice(i, i + 5).reduce((n, byte) => n * 256 + byte, 0);
        digits += String(chunk % 100000).padStart(5, "0");
      }
      return digits;
    };
    const [first, second] = [a, b].sort((p, q) => (p.userId < q.userId ? -1 : 1));
    return (await half(first)) + (await half(second));
  }

  /** 6-digit code shown on both browsers during device linking, so the user can tell their request from an injected one */
  static async linkCode(tempPublicKeyJWK: string): Promise<string> {
    const { x, y } = JSON.parse(tempPublicKeyJWK);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${x}.${y}`)));
    const n = hash.slice(0, 4).reduce((acc, byte) => acc * 256 + byte, 0) % 1_000_000;
    return String(n).padStart(6, "0");
  }

  /** Fresh random AES key for a team's messages (shared to members via wrapTeamKey) */
  static async generateTeamKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /** Encrypt the team key for one member: ECDH(wrapper private, member public), wrapper public key embedded */
  static async wrapTeamKey(
    teamKey: CryptoKey,
    memberPublicKey: CryptoKey,
    wrapperKeyPair: CryptoKeyPair
  ): Promise<string> {
    const raw = await crypto.subtle.exportKey("raw", teamKey);
    return await this.encryptMessageAsymmetric(this.arrayBufferToBase64(raw), memberPublicKey, wrapperKeyPair);
  }

  static async unwrapTeamKey(wrapped: string, userPrivateKey: CryptoKey): Promise<CryptoKey> {
    const rawBase64 = await this.decryptMessageAsymmetric(wrapped, userPrivateKey);
    return await crypto.subtle.importKey(
      "raw",
      this.base64ToArrayBuffer(rawBase64),
      { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
      true, // re-exported when wrapping for new members
      ["encrypt", "decrypt"]
    );
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
    receiverPublicKey: CryptoKey,
    // Sender's static pair (not an ephemeral one) so the sender can decrypt their own message too
    ephemeralKeyPair: CryptoKeyPair
  ): Promise<string> {

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
    userPrivateKey: CryptoKey,
    ownPublicKey?: CryptoKey,
    otherPublicKey?: CryptoKey
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
      let ephemeralPublicKey = await this.importPublicKeyFromJWK(ephemeralPublicKeyJWKString);

      // Message embeds our own public key => we wrote it; the shared secret is with the other party's key
      if (ownPublicKey && otherPublicKey) {
        const embedded = JSON.parse(ephemeralPublicKeyJWKString);
        const own = await crypto.subtle.exportKey("jwk", ownPublicKey);
        if (embedded.x === own.x && embedded.y === own.y) ephemeralPublicKey = otherPublicKey;
      }

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
          true, // must stay extractable: it is re-exported and uploaded on every load
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

  /**
   * Encrypt with a shared AES-GCM key (team messages). Format: iv:ciphertext:tag
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
   * Decrypt with a shared AES-GCM key (team messages)
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
