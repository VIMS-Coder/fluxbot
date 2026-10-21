/**
 * Types for the Fluxer public API.
 *
 * Shapes here are intentionally narrow: Fluxbot only depends on the fields it
 * actually reads, so a new optional field on the instance never breaks us.
 */

export interface InstanceEndpoints {
  /** Base URL for authenticated API requests (first-party client). */
  api: string;
  /** Base URL for client API requests. */
  api_client: string;
  /** Base URL for public API requests. Bots and third-party clients use this. */
  api_public: string;
  /** Main Gateway WebSocket URL (`ws:` or `wss:`). */
  gateway: string;
  /** Media proxy base URL. */
  media: string;
  /** Static asset CDN base URL. */
  static_cdn: string;
  /** Marketing site base URL. */
  marketing: string;
  /** Admin application base URL. */
  admin: string;
  /** Invite link base URL. */
  invite: string;
  /** Gift link base URL. */
  gift: string;
  /** Web application base URL. OAuth2 consent happens here. */
  webapp: string;
  /** Documentation site base URL. */
  docs?: string;
  /** Attachment upload relay base URL. */
  upload_relay?: string;
}

export interface InstanceFeatures {
  self_hosted?: boolean;
  voice_enabled?: boolean;
  emails_enabled?: boolean;
  presigned_attachment_uploads?: boolean;
  [key: string]: unknown;
}

export interface InstanceDiscovery {
  /** Protocol generation the deployment speaks. */
  codename?: string;
  api_code_version?: number;
  endpoints: InstanceEndpoints;
  features: InstanceFeatures;
  /** Unparsed discovery document, stored for forward compatibility. */
  raw: Record<string, unknown>;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface OAuthUserInfo {
  sub: string;
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email?: string | null;
  verified?: boolean;
  bot?: boolean;
}

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  /** Complete permission mask for the caller, as a decimal string. */
  permissions?: string;
  member_count?: number;
  online_count?: number;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed?: boolean;
}

export interface GuildChannel {
  id: string;
  name: string | null;
  type: number;
  position?: number;
  parent_id?: string | null;
}

export interface ApplicationMe {
  id: string;
  name: string;
  description?: string | null;
  redirect_uris?: string[];
  bot?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
}

export interface GatewayBotInfo {
  url: string;
  shards: number;
  session_start_limit: {
    total: number;
    remaining: number;
    reset_after: number;
    max_concurrency: number;
  };
}

export interface OAuthErrorBody {
  error: string;
  error_description?: string;
}

export class FluxerApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = 'FluxerApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
