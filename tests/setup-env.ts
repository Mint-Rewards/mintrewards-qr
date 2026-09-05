/**
 * Loads .env.local for integration tests.
 *
 * Kept dependency-free (no dotenv) since this is the only place that needs it.
 * Values already present in process.env win, so CI can override.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
