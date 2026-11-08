// Generates the key pair for realtime board tokens (ES256).
//
//   pnpm realtime-keys local       private key -> apps/web/.env.local
//                                  public key  -> apps/realtime/.dev.vars
//   pnpm realtime-keys production  private key -> Vercel (production + preview), via stdin
//                                  public key  -> apps/realtime/wrangler.jsonc (commit it)
//
// The private key is never printed. The public key is not a secret.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { exportJWK, generateKeyPair } from "jose";

const target = process.argv[2];
if (target !== "local" && target !== "production") {
  console.error("Usage: pnpm realtime-keys <local|production>");
  process.exit(1);
}

const pair = await generateKeyPair("ES256", { extractable: true });
const privateKey = JSON.stringify(await exportJWK(pair.privateKey));
const publicKey = JSON.stringify(await exportJWK(pair.publicKey));

function upsertEnv(file, name, value) {
  const line = `${name}='${value}'`;
  let content = existsSync(file) ? readFileSync(file, "utf8") : "";
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(content)) content = content.replace(pattern, line);
  else content += `${content && !content.endsWith("\n") ? "\n" : ""}${line}\n`;
  writeFileSync(file, content);
}

if (target === "local") {
  upsertEnv(".env.local", "REALTIME_TOKEN_PRIVATE_KEY", privateKey);
  upsertEnv("../realtime/.dev.vars", "REALTIME_TOKEN_PUBLIC_KEY", publicKey);
  console.log(
    "Wrote the private key to apps/web/.env.local and the public key to apps/realtime/.dev.vars.",
  );
  console.log("Restart both dev servers to pick them up.");
} else {
  for (const environment of ["production", "preview"]) {
    execFileSync(
      "vercel",
      ["env", "add", "REALTIME_TOKEN_PRIVATE_KEY", environment, "--sensitive", "--force", "--yes"],
      {
        input: privateKey,
        stdio: ["pipe", "inherit", "inherit"],
        shell: process.platform === "win32",
      },
    );
  }

  const configPath = "../realtime/wrangler.jsonc";
  const config = readFileSync(configPath, "utf8");
  const pattern = /("REALTIME_TOKEN_PUBLIC_KEY":\s*)"(?:[^"\\]|\\.)*"/;
  if (!pattern.test(config))
    throw new Error(`REALTIME_TOKEN_PUBLIC_KEY not found in ${configPath}`);
  writeFileSync(configPath, config.replace(pattern, `$1${JSON.stringify(publicKey)}`));

  console.log("Stored the private key in Vercel (production and preview).");
  console.log("Wrote the public key to apps/realtime/wrangler.jsonc. Commit that change.");
}
