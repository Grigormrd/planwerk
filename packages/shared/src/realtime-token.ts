import { importJWK, jwtVerify, SignJWT, type CryptoKey, type JWK } from "jose";
import { WorkspaceRole } from "./permissions";

/**
 * Short-lived tokens that let a browser join one board on the realtime
 * Worker. The web app signs them with a private key after checking
 * membership; the Worker only holds the public key, so it can verify tokens
 * but never mint them.
 */

export const REALTIME_TOKEN_TTL_SECONDS = 5 * 60;
const ALGORITHM = "ES256";
const ISSUER = "planwerk-web";
const AUDIENCE = "planwerk-realtime";

export interface BoardTokenClaims {
  userId: string;
  boardId: string;
  role: WorkspaceRole;
}

const keyCache = new Map<string, Promise<CryptoKey | Uint8Array>>();

function importKey(jwk: JWK): Promise<CryptoKey | Uint8Array> {
  const cacheKey = JSON.stringify(jwk);
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = importJWK(jwk, ALGORITHM);
    keyCache.set(cacheKey, key);
  }
  return key;
}

export async function signBoardToken(
  privateKey: JWK,
  claims: BoardTokenClaims,
  now = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ board: claims.boardId, role: claims.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + REALTIME_TOKEN_TTL_SECONDS)
    .sign(await importKey(privateKey));
}

/**
 * Returns the claims if the token is valid, unexpired and issued for this
 * board; otherwise `null`. Never throws for bad input.
 */
export async function verifyBoardToken(
  publicKey: JWK,
  token: string,
  boardId: string,
  now = new Date(),
): Promise<BoardTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, await importKey(publicKey), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    const role = WorkspaceRole.safeParse(payload.role);
    if (payload.board !== boardId || typeof payload.sub !== "string" || !role.success) {
      return null;
    }
    return { userId: payload.sub, boardId, role: role.data };
  } catch {
    return null;
  }
}

/** Parses a JWK from an environment variable; `null` if missing or malformed. */
export function parseJwk(value: string | undefined): JWK | null {
  if (!value) return null;
  try {
    const jwk = JSON.parse(value) as JWK;
    return typeof jwk === "object" && jwk !== null && typeof jwk.kty === "string" ? jwk : null;
  } catch {
    return null;
  }
}
