import axios from "axios";
import { config } from "./config.js";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.authScope,
  });

  const response = await axios.post<TokenResponse>(
    `${config.identityUrl}connect/token`,
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  cachedToken = response.data.access_token;
  // refresh 30s before actual expiry
  tokenExpiresAt = now + (response.data.expires_in - 30) * 1000;
  return cachedToken;
}
