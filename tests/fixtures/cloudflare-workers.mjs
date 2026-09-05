/** Minimal runtime stand-in for Vitest; policy tests inject their own limiter. */
export const env = {
  MCP_RATE_LIMITER: {
    async limit() {
      return { success: true };
    },
  },
};
