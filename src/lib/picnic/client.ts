/**
 * PicnicClient -- handles authentication and requests to the Picnic hackathon API.
 *
 * Usage:
 *   const client = new PicnicClient();
 *   await client.authenticate();
 *   const orders = await client.get("hackathon-list-orders", { limit: "20" });
 */

import type { PicnicAuthPayload } from "./types";

const BASE_URL =
  "https://storefront-prod.nl.picnicinternational.com/api/15";
const PAGES_URL = `${BASE_URL}/pages`;
const LOGIN_URL = `${BASE_URL}/user/login`;

const PICNIC_AGENT = "30100;3.3.0";
const PICNIC_DID = "AGENT-001";
const CLIENT_ID = 30100;

/** Maximum time (ms) allowed for any single fetch call. */
const REQUEST_TIMEOUT_MS = 10_000;

export class PicnicClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private email: string;
  private password: string;

  constructor(email?: string, password?: string) {
    this.email = email ?? process.env.PICNIC_EMAIL ?? "";
    this.password = password ?? process.env.PICNIC_PASSWORD ?? "";

    if (!this.email || !this.password) {
      throw new Error(
        "Picnic credentials missing. Set PICNIC_EMAIL and PICNIC_PASSWORD in .env"
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  async authenticate(): Promise<void> {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-picnic-agent": PICNIC_AGENT,
        "x-picnic-did": PICNIC_DID,
      },
      body: JSON.stringify({
        key: this.email,
        password: this.password,
        client_id: CLIENT_ID,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const authHeader = res.headers.get("x-picnic-auth");
    if (!authHeader) {
      throw new Error(
        `Picnic login failed (HTTP ${res.status}). No x-picnic-auth header received.`
      );
    }

    // Decode JWT to check 2FA status and expiry
    const payload = this.decodeJwtPayload(authHeader);

    if (payload["pc:2fa"] !== "NOT_REQUIRED") {
      throw new Error(
        "Picnic account requires 2FA. Hackathon accounts should have 2FA disabled. " +
          "Check your credentials or contact the hackathon organizers."
      );
    }

    this.token = authHeader;
    this.tokenExpiry = (payload.exp ?? 0) * 1000; // convert seconds to ms
  }

  /** True when there is no token or the JWT exp is within 60 s of now. */
  isTokenExpired(): boolean {
    if (!this.token) return true;
    return Date.now() >= this.tokenExpiry - 60_000;
  }

  /** Ensure we have a valid token, re-authenticating if needed. */
  private async ensureAuth(): Promise<void> {
    if (this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  // ---------------------------------------------------------------------------
  // Request helpers
  // ---------------------------------------------------------------------------

  /**
   * Execute a GET request against a hackathon page endpoint.
   *
   * @param endpoint - e.g. "hackathon-list-orders"
   * @param params  - query parameters as Record<string, string>
   * @param retry   - internal flag to avoid infinite retry loops
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string>,
    retry = true
  ): Promise<T> {
    await this.ensureAuth();

    const url = new URL(`${PAGES_URL}/${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.append(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = await res.json();

    // Empty `{}` response means auth token is bad
    if (this.isEmptyResponse(data) && retry) {
      this.token = null; // force re-auth
      return this.get<T>(endpoint, params, false);
    }

    return data as T;
  }

  /**
   * Execute a POST request against a hackathon task endpoint.
   *
   * @param endpoint - e.g. "hackathon-add-to-cart"
   * @param payload  - body payload (wrapped in { payload } automatically)
   * @param retry    - internal flag
   */
  async post<T = unknown>(
    endpoint: string,
    payload: Record<string, unknown>,
    retry = true
  ): Promise<T> {
    await this.ensureAuth();

    const res = await fetch(`${PAGES_URL}/task/${endpoint}`, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = await res.json();

    if (this.isEmptyResponse(data) && retry) {
      this.token = null;
      return this.post<T>(endpoint, payload, false);
    }

    return data as T;
  }

  /**
   * Execute a POST request against a direct REST endpoint (not hackathon-pages).
   *
   * @param path  - absolute path, e.g. "/api/15/cart/set_delivery_slot"
   * @param body  - raw JSON body (NOT wrapped in { payload })
   * @param retry - internal flag
   */
  async postDirect<T = unknown>(
    path: string,
    body: Record<string, unknown>,
    retry = true
  ): Promise<T> {
    await this.ensureAuth();

    const url = `https://storefront-prod.nl.picnicinternational.com${path}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // set_delivery_slot returns empty body (500) for invalid slot IDs
    const text = await res.text();
    if (!text) {
      throw new Error(`Empty response from ${path} (HTTP ${res.status})`);
    }

    const data = JSON.parse(text) as T;

    if (this.isEmptyResponse(data) && retry) {
      this.token = null;
      return this.postDirect<T>(path, body, false);
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // Internal utilities
  // ---------------------------------------------------------------------------

  private authHeaders(): Record<string, string> {
    return {
      "x-picnic-auth": this.token!,
      "x-picnic-agent": PICNIC_AGENT,
      "x-picnic-did": PICNIC_DID,
    };
  }

  /**
   * Decode the payload section of a JWT without verifying the signature.
   * Works in Node.js using Buffer.
   */
  private decodeJwtPayload(jwt: string): PicnicAuthPayload {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format received from Picnic login.");
    }

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json) as PicnicAuthPayload;
  }

  /**
   * Check if the API returned an empty object `{}`, which signals a bad token.
   */
  private isEmptyResponse(data: unknown): boolean {
    if (data === null || data === undefined) return true;
    if (typeof data === "object" && Object.keys(data as object).length === 0) {
      return true;
    }
    return false;
  }
}
