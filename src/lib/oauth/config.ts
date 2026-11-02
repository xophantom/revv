// Shared by the OAuth authorization server and the MCP resource server.
export const MCP_PATH = "/api/mcp";
// One scope: full access to the user's own garage. offline_access makes Claude ask for a refresh token.
export const MCP_SCOPE = "revv";
export const SCOPES_SUPPORTED = [MCP_SCOPE, "offline_access"] as const;

export const AUTHORIZE_PATH = "/oauth/authorize";
export const TOKEN_PATH = "/api/oauth/token";
export const REGISTER_PATH = "/api/oauth/register";
export const REVOKE_PATH = "/api/oauth/revoke";

// Return path for a magic-link sign-in, kept in the requesting browser instead of the e-mailed link.
export const RETURN_COOKIE = "revv_return";

export const mcpResource = (origin: string) => `${origin}${MCP_PATH}`;
