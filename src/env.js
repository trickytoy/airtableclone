import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    // Removed: AUTH_DISCORD_ID and AUTH_DISCORD_SECRET
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    // Removed: AUTH_DISCORD_ID and AUTH_DISCORD_SECRET
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },

  /**
   * Skip validation if needed (e.g., for Docker builds).
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Empty string = undefined
   */
  emptyStringAsUndefined: true,
});
