import { $ } from "bun"

// Build info
const pkg = await Bun.file("package.json").json()
const proc = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"])
const hash = proc.stdout.toString().trim()
const buildInfo = {
  version: pkg.version,
  commit: hash,
  built: new Date().toISOString(),
}

// Build the Chrome extension (browser bundle)
const extOutdir = "dist"
const extResult = await Bun.build({
  entrypoints: ["src/background.ts", "src/content.ts", "src/sidebar/sidebar.ts", "src/tab/tab.ts"],
  outdir: extOutdir,
  target: "browser",
  format: "esm",
})
if (!extResult.success) {
  console.error("Extension build failed:", extResult.logs)
  process.exit(1)
}

await Bun.write(`${extOutdir}/manifest.json`, Bun.file("src/manifest.json"))
await Bun.write(`${extOutdir}/sidebar/sidebar.html`, Bun.file("src/sidebar/sidebar.html"))
await Bun.write(`${extOutdir}/tab/tab.html`, Bun.file("src/tab/tab.html"))
await Bun.write(`${extOutdir}/build-info.json`, JSON.stringify(buildInfo, null, 2))
console.log("Extension built to", extOutdir)

// Bundle the native host
const binOutdir = "bin"
const hostResult = await Bun.build({
  entrypoints: ["src/native-host/index.ts"],
  outdir: binOutdir,
  target: "bun",
  format: "esm",
})
if (!hostResult.success) {
  console.error("Native host build failed:", hostResult.logs)
  process.exit(1)
}
console.log("Native host bundled to", binOutdir)

// Compile to standalone binary
await $`bun build --compile src/native-host/index.ts --outfile bin/browser-companion-host`
console.log("Native host binary compiled to bin/browser-companion-host")
