use std::{collections::HashMap, sync::Mutex};

/// Secrets authorized by the OS for this process. Never serialized or sent to the webview.
/// Keep them through connection close/reopen, and drop them when Zap exits.
#[derive(Default)]
pub struct CredentialCache {
    passwords: Mutex<HashMap<String, String>>,
}
impl CredentialCache {
    pub fn get_or_load(
        &self,
        id: &str,
        load: impl FnOnce() -> Result<String, String>,
    ) -> Result<String, String> {
        // Serialize concurrent lookups so they cannot show duplicate Keychain prompts.
        let mut passwords = self.passwords.lock().map_err(|e| e.to_string())?;
        if let Some(password) = passwords.get(id) {
            return Ok(password.clone());
        }
        let password = load()?;
        passwords.insert(id.to_owned(), password.clone());
        Ok(password)
    }
    pub fn write(
        &self,
        id: &str,
        password: &str,
        persist: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        let mut passwords = self.passwords.lock().map_err(|e| e.to_string())?;
        persist()?;
        passwords.insert(id.to_owned(), password.to_owned());
        Ok(())
    }
    pub fn remove(
        &self,
        id: &str,
        delete: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        let mut passwords = self.passwords.lock().map_err(|e| e.to_string())?;
        delete()?;
        passwords.remove(id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reopen_and_test_reuse_the_authorized_secret() {
        let cache = CredentialCache::default();
        assert_eq!(
            cache.get_or_load("one", || Ok("secret".into())).unwrap(),
            "secret"
        );
        assert_eq!(
            cache
                .get_or_load("one", || panic!("must not read Keychain again"))
                .unwrap(),
            "secret"
        );
        assert_eq!(
            cache.get_or_load("two", || Ok("other".into())).unwrap(),
            "other"
        );
    }
    #[test]
    fn denied_access_is_not_cached() {
        let cache = CredentialCache::default();
        assert!(cache.get_or_load("one", || Err("denied".into())).is_err());
        assert_eq!(
            cache
                .get_or_load("one", || Ok("authorized".into()))
                .unwrap(),
            "authorized"
        );
    }
    #[test]
    fn replacing_and_removing_credentials_updates_the_cache() {
        let cache = CredentialCache::default();
        cache.get_or_load("one", || Ok("old".into())).unwrap();
        assert!(cache
            .write("one", "not-saved", || Err("denied".into()))
            .is_err());
        assert_eq!(cache.get_or_load("one", || panic!()).unwrap(), "old");
        cache.write("one", "new", || Ok(())).unwrap();
        assert_eq!(cache.get_or_load("one", || panic!()).unwrap(), "new");
        assert!(cache.remove("one", || Err("denied".into())).is_err());
        assert_eq!(cache.get_or_load("one", || panic!()).unwrap(), "new");
        cache.remove("one", || Ok(())).unwrap();
        assert_eq!(
            cache.get_or_load("one", || Ok("recreated".into())).unwrap(),
            "recreated"
        );
    }
    #[test]
    fn a_new_app_session_reads_keychain_again() {
        let first = CredentialCache::default();
        first.get_or_load("one", || Ok("old".into())).unwrap();
        drop(first);
        let next = CredentialCache::default();
        assert_eq!(
            next.get_or_load("one", || Ok("current".into())).unwrap(),
            "current"
        );
    }
}
