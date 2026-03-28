import { readFileSync } from "fs";
import { join } from "path";

let soulContent: string | null = null;

export function getSoulBlock(): string {
  if (!soulContent) {
    try {
      soulContent = readFileSync(join(process.cwd(), "SOUL.md"), "utf-8");
    } catch {
      soulContent = "Weekly grocery planning agent for Picnic households.";
    }
  }
  return `<soul>\n${soulContent}\n</soul>\n\n`;
}
