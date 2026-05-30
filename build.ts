import { build } from "bun"

const outdir = "dist"

await build({
  entrypoints: ["src/background.ts", "src/tab/tab.ts"],
  outdir,
  target: "browser",
  format: "esm",
})

await Bun.write(`${outdir}/manifest.json`, Bun.file("src/manifest.json"))
await Bun.write(`${outdir}/tab/tab.html`, Bun.file("src/tab/tab.html"))

console.log("Built extension to", outdir)
