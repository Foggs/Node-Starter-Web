const REQUIRED_VARS = [
  "ELEVENLABS_API_KEY",
  "OPENAI_API_KEY",
  "ELEVENLABS_AGENT_ID",
] as const;

export function validateEnv(): void {
  if (process.env["NODE_ENV"] === "test") return;

  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `[Exit Coach] Missing required environment variable(s): ${missing.join(", ")}.\n` +
        `Set them before starting the server.`,
    );
    process.exit(1);
  }
}
