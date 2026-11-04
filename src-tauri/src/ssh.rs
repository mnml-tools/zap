use serde::{Deserialize, Serialize};
use std::{
    io::Read,
    net::{Ipv4Addr, TcpListener},
    process::{Child, Command, Stdio},
    time::Duration,
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSettings {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub key_path: String,
}

pub struct Tunnel {
    child: Child,
    pub port: u16,
}

impl Drop for Tunnel {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Tunnel {
    pub async fn open(
        settings: &SshSettings,
        database_host: &str,
        database_port: u16,
    ) -> Result<Self, String> {
        let ssh_host = settings
            .host
            .trim()
            .trim_start_matches('[')
            .trim_end_matches(']');
        let user = settings.user.trim();
        let database_host = database_host
            .trim()
            .trim_start_matches('[')
            .trim_end_matches(']');
        let valid_host = |host: &str| {
            !host.is_empty()
                && !host.starts_with('-')
                && host.bytes().all(|byte| {
                    byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_' | b':')
                })
        };
        if !valid_host(ssh_host)
            || !valid_host(database_host)
            || settings.port == 0
            || database_port == 0
            || user.is_empty()
            || !user
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
        {
            return Err("Enter a valid SSH host, user, port, and database address.".into());
        }

        let listener =
            TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|error| error.to_string())?;
        let port = listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port();
        let target = if database_host.contains(':') {
            format!("[{database_host}]")
        } else {
            database_host.into()
        };
        let mut command = Command::new("ssh");
        command
            .args([
                "-N",
                "-T",
                "-o",
                "BatchMode=yes",
                "-o",
                "StrictHostKeyChecking=yes",
                "-o",
                "GatewayPorts=no",
                "-o",
                "ExitOnForwardFailure=yes",
                "-o",
                "ConnectTimeout=10",
                "-o",
                "ServerAliveInterval=15",
                "-o",
                "ServerAliveCountMax=3",
                "-o",
                "ControlMaster=no",
                "-o",
                "ControlPath=none",
                "-o",
                "ForkAfterAuthentication=no",
            ])
            .arg("-p")
            .arg(settings.port.to_string())
            .args(["-l", user])
            .arg("-L")
            .arg(format!("127.0.0.1:{port}:{target}:{database_port}"));
        if !settings.key_path.trim().is_empty() {
            command.args(["-i", settings.key_path.trim()]);
        }
        command
            .arg(ssh_host)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        drop(listener);
        let child = command.spawn().map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "Zap could not find the system OpenSSH client (ssh).".into()
            } else {
                format!("Could not start SSH: {error}")
            }
        })?;
        let mut tunnel = Self { child, port };
        let ready = tokio::time::timeout(Duration::from_secs(12), async {
            loop {
                if tunnel
                    .child
                    .try_wait()
                    .map_err(|error| error.to_string())?
                    .is_some()
                {
                    let mut details = String::new();
                    if let Some(mut stderr) = tunnel.child.stderr.take() {
                        let _ = stderr.read_to_string(&mut details);
                    }
                    return Err(format!("SSH tunnel failed. {}", details.trim()));
                }

                if std::net::TcpStream::connect((Ipv4Addr::LOCALHOST, port)).is_ok() {
                    return Ok(());
                }
                tokio::time::sleep(Duration::from_millis(75)).await;
            }
        })
        .await;
        ready.map_err(|_| "Timed out waiting for the SSH tunnel.".to_string())??;
        // Keep draining diagnostics so long-lived tunnels cannot block on stderr.
        if let Some(mut stderr) = tunnel.child.stderr.take() {
            std::thread::spawn(move || {
                let _ = std::io::copy(&mut stderr, &mut std::io::sink());
            });
        }
        Ok(tunnel)
    }
}
