import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function safeStr(v) {
  return v == null ? "" : String(v).trim();
}

function ensureEsbuildBinary() {
  if (process.platform !== "win32") return;
  if (safeStr(process.env.ESBUILD_BINARY_PATH)) return;

  let src = "";
  try {
    src = require.resolve("@esbuild/win32-x64/esbuild.exe");
  } catch {
    // If optional deps are missing, Vite/esbuild will surface a clearer error.
    return;
  }

  const dstDir = path.join(os.tmpdir(), "fluke-arcade-esbuild");
  const dst = path.join(dstDir, "esbuild.exe");

  try {
    fs.mkdirSync(dstDir, { recursive: true });
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
    }
    process.env.ESBUILD_BINARY_PATH = dst;
  } catch {
    // If we can't copy, we fall back to default behavior.
  }
}

ensureEsbuildBinary();

const { build } = await import("vite");
const react = (await import("@vitejs/plugin-react")).default;

await build({
  plugins: [react()],
  base: "/",
});

