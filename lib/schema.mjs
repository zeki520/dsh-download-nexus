import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_CONFIG } from './config.mjs'

/**
 * P0 configuration schema for the bundle config page.
 *
 * Only the 14 fields a user may edit on the page are `.volatile()`; the nine
 * safety/lifecycle fields stay ordinary so the page cannot turn them into a
 * writable form. Every field has a default so an old patch that predates this
 * schema still resolves to the exact 0.1.6 defaults.
 */
export const Config = Schema.object({
  // ---- editable (14, volatile) -------------------------------------------
  defaultSaveDir: Schema.string().default(DEFAULT_CONFIG.defaultSaveDir).volatile(),
  allowedRoots: Schema.array(Schema.string())
    .default([...DEFAULT_CONFIG.allowedRoots])
    .volatile(),
  connections: Schema.union([Schema.number(), Schema.string()]).default(DEFAULT_CONFIG.connections).volatile(),
  maxBytes: Schema.union([Schema.number(), Schema.string()]).default(DEFAULT_CONFIG.maxBytes).volatile(),
  requestTimeoutMs: Schema.union([Schema.number(), Schema.string()]).default(DEFAULT_CONFIG.requestTimeoutMs).volatile(),
  pollMs: Schema.union([Schema.number(), Schema.string()]).default(DEFAULT_CONFIG.pollMs).volatile(),
  maxWaitSeconds: Schema.union([Schema.number(), Schema.string()]).default(DEFAULT_CONFIG.maxWaitSeconds).volatile(),
  // Older patches may store this as a single string ("7890;31181").
  // Keep the schema permissive; loadConfig() normalizes it to number[].
  proxyCandidates: Schema.union([Schema.array(Schema.any()), Schema.string()])
    .default([...DEFAULT_CONFIG.proxyCandidates])
    .volatile(),
  ytdlpPath: Schema.string().default(DEFAULT_CONFIG.ytdlpPath).volatile(),
  hfPath: Schema.string().default(DEFAULT_CONFIG.hfPath).volatile(),
  hfMirror: Schema.string().default(DEFAULT_CONFIG.hfMirror).volatile(),
  useHfMirror: Schema.boolean().default(DEFAULT_CONFIG.useHfMirror).volatile(),
  githubMirrorBase: Schema.string().default(DEFAULT_CONFIG.githubMirrorBase).volatile(),
  githubMirrorDefault: Schema.boolean().default(DEFAULT_CONFIG.githubMirrorDefault).volatile(),

  // ---- read-only on the page (9, non-volatile) ---------------------------
  toolPrefix: Schema.string().default(DEFAULT_CONFIG.toolPrefix),
  allowExecutable: Schema.boolean().default(DEFAULT_CONFIG.allowExecutable),
  allowShell: Schema.boolean().default(DEFAULT_CONFIG.allowShell),
  guardFailClosed: Schema.boolean().default(DEFAULT_CONFIG.guardFailClosed),
  allowBrowserCookies: Schema.boolean().default(DEFAULT_CONFIG.allowBrowserCookies),
  autoStartMotrix: Schema.boolean().default(false),
  motrixStateDir: Schema.string().default(DEFAULT_CONFIG.motrixStateDir),
  promptOrder: Schema.number().default(DEFAULT_CONFIG.promptOrder),
  promptName: Schema.string().default(DEFAULT_CONFIG.promptName),
})
