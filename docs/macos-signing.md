# Sign and notarize Zap for macOS

This guide covers distributing Zap through GitHub Releases or your website with an Apple Developer ID signature and notarization. It assumes an active Apple Developer Program membership and a Mac. Start with a local build, then configure CI.

## What Zap already has

- Product name: `Zap`.
- Bundle identifier: `eu.rafms.zap` in `src-tauri/tauri.conf.json`.
- Local packaging: `npm run build:mac` produces an app and DMG for the host architecture.
- CI: `.github/workflows/desktop.yml` builds a universal app for Intel and Apple Silicon, then archives it as `Zap-macos-universal.app.zip`.
- Version-tag builds also produce updater archives and signatures.

The current workflow does not pass Apple credentials. Adding GitHub secrets alone will not enable signing; the build step must also reference them as described below.

| Mechanism               | Purpose                                                    | Credential                                               |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Apple code signing      | Identifies the publisher and detects modified app contents | Developer ID Application certificate and its private key |
| Apple notarization      | Obtains Apple's automated distribution assessment          | Apple account authentication                             |
| Tauri updater signature | Lets installed Zap versions verify downloaded updates      | Existing `TAURI_SIGNING_PRIVATE_KEY`                     |

Keep the existing updater key pair when adding Apple signing. The Apple certificate does not replace it.

## 1. Install the Apple tools

Install Xcode from Apple, open it once, and complete its initial setup. Check the active toolchain:

```sh
xcode-select -p
xcrun --find notarytool
xcrun --find stapler
```

If the commands select an incomplete toolchain, select your Xcode installation:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

## 2. Create your signing certificate

For downloads outside the Mac App Store, use **Developer ID Application**. Apple lists the Account Holder role as required to create this certificate; an organization member may need their Account Holder's help. See [Apple's Developer ID certificate instructions](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/).

1. Open **Keychain Access** on the Mac that will hold the signing key.
2. Choose **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**.
3. Enter your email and name, leave the CA email blank, select **Saved to disk**, and save the CSR.
4. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list), add a certificate, and choose **Developer ID Application**.
5. Upload the CSR, download the resulting `.cer`, and open it to install it in your login keychain.
6. In **My Certificates**, expand the certificate and confirm its private key is present.

Find its exact identity:

```sh
security find-identity -v -p codesigning
```

Look for a value shaped like `Developer ID Application: Your Name (ABCDE12345)`. Use the complete identity, including the team suffix. The downloaded certificate alone is insufficient on another machine without its matching private key.

## 3. Set up notarization authentication

Create an **app-specific password** for your Apple account at [Apple Account](https://account.apple.com/) under **Sign-In and Security → App-Specific Passwords**. Find your Team ID in your [Developer membership details](https://developer.apple.com/account/).

In a fresh zsh terminal, set these values. Replace the examples with your own identity, account email, and Team ID:

```sh
export APPLE_SIGNING_IDENTITY='Developer ID Application: Your Name (ABCDE12345)'
export APPLE_ID='you@example.com'
export APPLE_TEAM_ID='ABCDE12345'
read -rs 'APPLE_PASSWORD?Apple app-specific password: '
export APPLE_PASSWORD
```

The hidden prompt keeps the password out of shell history. Tauri uses these variables to authenticate, notarize, and staple during packaging. See [Tauri's signing guide](https://v2.tauri.app/distribute/sign/macos/).

An App Store Connect team API key is an alternative: set `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH` to the issuer ID, key ID, and downloaded `.p8` path. Use one authentication method consistently; see [Tauri's environment variable reference](https://v2.tauri.app/reference/environment-variables/).

## 4. Build a signed universal app

From the repository root, in the same terminal:

```sh
npm ci
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run icons
npm run tauri build -- --target universal-apple-darwin --bundles app -- --locked
```

This matches the architecture and bundle used by Zap's CI. Wait for the notarization and stapling stages to finish successfully before distributing it.

The output is:

```text
src-tauri/target/universal-apple-darwin/release/bundle/macos/Zap.app
```

For an app and DMG for your current Mac architecture, use `npm run build:mac` instead. Those outputs live under `src-tauri/target/release/bundle/`. To build a universal DMG too, change `--bundles app` above to `--bundles app,dmg`.

Tauri's installed configuration schema defaults hardened runtime to enabled. Keep that default. Zap's current configuration has no custom entitlements; add any future entitlements deliberately rather than copying unrelated Electron settings.

## 5. Verify and package the result

For the universal app:

```sh
ZAP_APP='src-tauri/target/universal-apple-darwin/release/bundle/macos/Zap.app'
codesign --verify --deep --strict --verbose=2 "$ZAP_APP"
codesign --display --verbose=4 "$ZAP_APP"
xcrun stapler validate "$ZAP_APP"
spctl --assess --type execute --verbose=4 "$ZAP_APP"
```

Check that the displayed authority is your Developer ID Application certificate, the TeamIdentifier matches your team, and the runtime flag is present. Stapler validation should succeed; Gatekeeper assessment should report acceptance with a notarized Developer ID source.

Create the downloadable ZIP only after those checks pass:

```sh
mkdir -p artifacts
ditto -c -k --sequesterRsrc --keepParent \
  "$ZAP_APP" artifacts/Zap-macos-universal.app.zip
unset APPLE_PASSWORD
```

Apple explains that ZIP files cannot themselves be stapled: staple the app, then archive it. See [Apple's command-line notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow).

Download the final ZIP through a browser on another Mac, extract it, and launch Zap. Check database connections and Keychain access. This exercises the downloaded-app path rather than only launching a local build.

## 6. Enable signing in GitHub Actions

### Export the certificate

In Keychain Access, export the Developer ID Application identity, including its private key, as a password-protected `.p12`. Store it outside the repository, then encode it:

```sh
openssl base64 -A -in /path/to/Zap-Developer-ID.p12 \
  -out /path/to/Zap-Developer-ID-base64.txt
```

Treat the `.p12`, its base64 copy, and password as private signing material. Back them up securely; base64 is encoding, not encryption.

### Add repository secrets

In `mnml-tools/zap`, open **Settings → Secrets and variables → Actions → New repository secret**. See [GitHub's secrets guide](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

| Secret                       | Value                                  |
| ---------------------------- | -------------------------------------- |
| `APPLE_CERTIFICATE`          | Contents of the base64 file            |
| `APPLE_CERTIFICATE_PASSWORD` | Password chosen for the `.p12` export  |
| `APPLE_SIGNING_IDENTITY`     | Full Developer ID Application identity |
| `APPLE_ID`                   | Apple account email                    |
| `APPLE_PASSWORD`             | App-specific password                  |
| `APPLE_TEAM_ID`              | Developer Team ID                      |

### Wire secrets into the macOS build

Replace the existing **Build desktop package** step with these two steps. This example signs every macOS build handled by the current workflow, including manual runs; the Linux command and updater variables retain their current behavior.

```yaml
- name: Build macOS package
  if: runner.os == 'macOS'
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.TAURI_SIGNING_PRIVATE_KEY || '' }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' }}
  run: |
    set -euo pipefail
    for name in APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
      if [[ -z "${!name}" ]]; then
        echo "Missing required secret: $name" >&2
        exit 1
      fi
    done
    npm run tauri build -- --ci ${{ matrix.args }} -- --locked
    ZAP_APP='src-tauri/target/universal-apple-darwin/release/bundle/macos/Zap.app'
    codesign --verify --deep --strict --verbose=2 "$ZAP_APP"
    xcrun stapler validate "$ZAP_APP"
    spctl --assess --type execute --verbose=4 "$ZAP_APP"

- name: Build Linux package
  if: runner.os == 'Linux'
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.TAURI_SIGNING_PRIVATE_KEY || '' }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' }}
  run: npm run tauri build -- --ci ${{ matrix.args }} -- --locked
```

Tauri accepts the encoded certificate and export password through these variables. The verification commands stop the job before archiving if signing or stapling fails. Leave the existing archive, artifact upload, updater configuration, and release steps in place. These are proposed workflow edits; this guide does not apply them.

Test through **Actions → Desktop builds → Run workflow** on the branch containing your workflow edits before pushing a release tag. Download its artifact and test it on another Mac. For version releases, also keep the three updater secrets documented in the [README](../README.md#configure-github-signing-secrets).

## Troubleshooting

| Symptom                                       | Check                                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| No valid signing identity                     | In My Certificates, confirm the matching private key is present and the certificate is valid. Re-run `security find-identity`.    |
| Keychain prompts or signing permission errors | Unlock the login keychain for local builds. For CI, check the `.p12` includes the private key and its export password is correct. |
| Apple authentication fails                    | Use an app-specific password, verify the Team ID and membership, and check the developer portal for account requirements.         |
| Notarization rejected                         | Retrieve Apple's submission log using the submission ID; fix the reported binary or entitlement issue and rebuild.                |
| Stapler cannot find a ticket                  | Confirm notarization was accepted for this exact build. Do not publish an unverified archive.                                     |
| ZIP still triggers an unverified-app warning  | Inspect the extracted app; confirm the ZIP was made from the signed, stapled build rather than an older output.                   |
| Updater signature fails                       | Check the Tauri updater key pair separately from the Apple certificate.                                                           |

To retrieve a notarization log, store credentials interactively in a local Keychain profile, then use the submission ID from the build output:

```sh
xcrun notarytool store-credentials 'zap-notary'
xcrun notarytool log SUBMISSION_ID --keychain-profile 'zap-notary' /tmp/zap-notary-log.json
```

For a pending submission, use `xcrun notarytool info SUBMISSION_ID --keychain-profile 'zap-notary'`. Rebuilding or modifying the app requires signing and notarizing the resulting build again.
