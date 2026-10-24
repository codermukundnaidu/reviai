import { Storage } from "@google-cloud/storage";
import { createHash } from "node:crypto";

const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: { url: `${sidecar}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});
export const generatedFileNames = ["index.html", "app.css", "app.js"] as const;
export type GeneratedFileName = typeof generatedFileNames[number];
export const fileHash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
export function isGeneratedFileName(value: string): value is GeneratedFileName {
  return generatedFileNames.includes(value as GeneratedFileName);
}
function object(projectId: string, buildId: string, name: GeneratedFileName) {
  if (![projectId, buildId].every(id => /^[a-f0-9-]{36}$/i.test(id)) || !isGeneratedFileName(name)) {
    throw new Error("Invalid generated artifact path");
  }
  const parts = process.env.PRIVATE_OBJECT_DIR?.split("/").filter(Boolean);
  if (!parts?.length) throw new Error("App Storage is not configured");
  return storage.bucket(parts[0]).file(`${parts.slice(1).join("/")}/revi-builds/${projectId}/${buildId}/${name}`);
}
export async function saveGeneratedFile(projectId: string, buildId: string, name: GeneratedFileName, content: string) {
  const file = object(projectId, buildId, name);
  await file.save(content, { resumable: false, metadata: {
    contentType: name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css" : "text/javascript",
    cacheControl: "private, no-store",
  } });
  return { name, bytes: Buffer.byteLength(content), sha256: fileHash(content) };
}
export async function readGeneratedFile(projectId: string, buildId: string, name: GeneratedFileName) {
  const [content] = await object(projectId, buildId, name).download();
  return content;
}
