use anyhow::{Context, Result};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::hkdf;
use ring::rand::{SecureRandom, SystemRandom};

#[cfg(unix)]
use hostname;
#[cfg(unix)]
use libc;

/// 32-byte salt stored in `encryption_meta.key_salt`.
pub const SALT_LEN: usize = 32;
/// 12-byte nonce for AES-256-GCM.
pub const NONCE_LEN: usize = 12;

/// Derives a 32-byte AES-256 key from a machine identifier and salt using HKDF-SHA256.
fn derive_key(machine_id: &[u8], salt: &[u8]) -> [u8; 32] {
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, salt);
    let prk = salt.extract(machine_id);
    let okm = prk.expand(&[b"flock-api-key-v1"], hkdf::HKDF_SHA256).unwrap();
    let mut key = [0u8; 32];
    okm.fill(&mut key).unwrap();
    key
}

/// Get a stable machine identifier for key derivation.
///
/// On Windows: reads `MachineGuid` from the registry.
/// On other platforms: falls back to hostname + uid.
pub fn get_machine_id() -> Result<Vec<u8>> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let key = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography")
            .context("Failed to open Cryptography registry key")?;
        let guid: String = key.get_value("MachineGuid")
            .context("Failed to read MachineGuid")?;
        Ok(guid.into_bytes())
    }

    #[cfg(unix)]
    {   
        
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());
        let uid = unsafe { libc::getuid() };
        Ok(format!("{}:{}", hostname, uid).into_bytes())
    }
}

/// Generate a random 32-byte salt.
pub fn generate_salt() -> Result<[u8; SALT_LEN]> {
    let rng = SystemRandom::new();
    let mut salt = [0u8; SALT_LEN];
    rng.fill(&mut salt)
        .map_err(|e| anyhow::anyhow!("RNG error: {:?}", e))?;
    Ok(salt)
}

/// Encrypt a plaintext string using AES-256-GCM.
///
/// Returns `(ciphertext_base64, nonce_base64)`.
pub fn encrypt(plaintext: &str, machine_id: &[u8], salt: &[u8]) -> Result<(String, String)> {
    let key_bytes = derive_key(machine_id, salt);
    let unbound = UnboundKey::new(&AES_256_GCM, &key_bytes)
        .map_err(|e| anyhow::anyhow!("Key error: {:?}", e))?;
    let key = LessSafeKey::new(unbound);

    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill(&mut nonce_bytes)
        .map_err(|e| anyhow::anyhow!("RNG error: {:?}", e))?;
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);

    let mut in_out = plaintext.as_bytes().to_vec();
    key.seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| anyhow::anyhow!("Encrypt error: {:?}", e))?;

    Ok((BASE64.encode(&in_out), BASE64.encode(&nonce_bytes)))
}

/// Decrypt a ciphertext (base64) using AES-256-GCM.
pub fn decrypt(
    ciphertext_b64: &str,
    nonce_b64: &str,
    machine_id: &[u8],
    salt: &[u8],
) -> Result<String> {
    let key_bytes = derive_key(machine_id, salt);
    let unbound = UnboundKey::new(&AES_256_GCM, &key_bytes)
        .map_err(|e| anyhow::anyhow!("Key error: {:?}", e))?;
    let key = LessSafeKey::new(unbound);

    let nonce_bytes = BASE64.decode(nonce_b64).context("Invalid nonce base64")?;
    if nonce_bytes.len() != NONCE_LEN {
        anyhow::bail!("Invalid nonce length");
    }
    let nonce = Nonce::assume_unique_for_key(nonce_bytes.try_into().unwrap());

    let mut ciphertext = BASE64.decode(ciphertext_b64).context("Invalid ciphertext base64")?;
    let plaintext = key
        .open_in_place(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|e| anyhow::anyhow!("Decrypt error: {:?}", e))?;

    String::from_utf8(plaintext.to_vec()).context("Decrypted data is not valid UTF-8")
}

/// High-level encrypt that handles machine_id + salt internally.
pub fn encrypt_value(plaintext: &str, salt: &[u8]) -> Result<(String, String)> {
    let machine_id = get_machine_id()?;
    encrypt(plaintext, &machine_id, salt)
}

/// High-level decrypt that handles machine_id + salt internally.
pub fn decrypt_value(ciphertext_b64: &str, nonce_b64: &str, salt: &[u8]) -> Result<String> {
    let machine_id = get_machine_id()?;
    decrypt(ciphertext_b64, nonce_b64, &machine_id, salt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let machine_id = b"test-machine-id-12345";
        let salt = generate_salt().unwrap();
        let plaintext = "sk-ant-api03-very-secret-key-12345";

        let (ct, nonce) = encrypt(plaintext, machine_id, &salt).unwrap();
        let decrypted = decrypt(&ct, &nonce, machine_id, &salt).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_different_nonces() {
        let machine_id = b"test-machine-id";
        let salt = generate_salt().unwrap();

        let (ct1, n1) = encrypt("hello", machine_id, &salt).unwrap();
        let (ct2, n2) = encrypt("hello", machine_id, &salt).unwrap();

        // Nonces should differ (extremely high probability)
        assert_ne!(n1, n2);
        // Ciphertexts should differ (different nonce)
        assert_ne!(ct1, ct2);
    }

    #[test]
    fn test_wrong_key_fails() {
        let salt = generate_salt().unwrap();
        let (ct, nonce) = encrypt("secret", b"machine-a", &salt).unwrap();
        let result = decrypt(&ct, &nonce, b"machine-b", &salt);
        assert!(result.is_err());
    }

    #[test]
    fn test_derive_key_deterministic() {
        let machine_id = b"stable-id";
        let salt = [1u8; 32];
        let k1 = derive_key(machine_id, &salt);
        let k2 = derive_key(machine_id, &salt);
        assert_eq!(k1, k2);
    }
}
