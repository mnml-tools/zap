import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const project = new URL('../', import.meta.url)
const source = fileURLToPath(new URL('src-tauri/icons/AppIcon.icon', project))
const output = fileURLToPath(new URL('src-tauri/target/macos-icon/', project))

if (process.platform !== 'darwin') {
  throw new Error('The macOS icon must be compiled on macOS with Xcode installed.')
}

mkdirSync(output, { recursive: true })

// Xcode 27's icon compiler can fail with inherited stdin when launched by Tauri.
// Compile separately with stdin closed, then let Tauri package the asset catalog.
const result = spawnSync(
  'xcrun',
  [
    'actool',
    source,
    '--compile',
    output,
    '--output-format',
    'human-readable-text',
    '--output-partial-info-plist',
    `${output}/icon-info.plist`,
    '--app-icon',
    'AppIcon',
    '--include-all-app-icons',
    '--platform',
    'macosx',
    '--target-device',
    'mac',
    '--minimum-deployment-target',
    '26.0'
  ],
  { stdio: ['ignore', 'inherit', 'inherit'] }
)

if (result.error) throw result.error
process.exit(result.status ?? 1)
