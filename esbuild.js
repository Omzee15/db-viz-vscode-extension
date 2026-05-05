const esbuild = require("esbuild");
const path = require("path");

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

const commonOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: false,
  logLevel: "info",
};

// Build extension host (Node.js / CommonJS)
const extensionBuild = esbuild.context({
  ...commonOptions,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  target: "node18",
});

// Build webview (browser / ESM → IIFE)
// CSS imports are bundled into dist/webview.css automatically by esbuild.
const webviewBuild = esbuild.context({
  ...commonOptions,
  entryPoints: ["src/webview/index.tsx"],
  outfile: "dist/webview.js",
  platform: "browser",
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
    "global": "globalThis",
  },
});

async function main() {
  const [ext, web] = await Promise.all([extensionBuild, webviewBuild]);

  if (isWatch) {
    console.log("Watching for changes...");
    await Promise.all([ext.watch(), web.watch()]);
  } else {
    await Promise.all([ext.rebuild(), web.rebuild()]);
    await Promise.all([ext.dispose(), web.dispose()]);
    console.log("Build complete.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
