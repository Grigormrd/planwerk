import { base64url, exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  parseJwk,
  REALTIME_TOKEN_TTL_SECONDS,
  signBoardToken,
  verifyBoardToken,
} from "./realtime-token";

const boardId = "3f1c2b7e-8a4d-4c9e-9b1a-2d5e6f7a8b9c";
const otherBoard = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
let privateKey: JWK;
let publicKey: JWK;
let strangerKey: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  privateKey = await exportJWK(pair.privateKey);
  publicKey = await exportJWK(pair.publicKey);
  strangerKey = await exportJWK((await generateKeyPair("ES256", { extractable: true })).privateKey);
});

describe("board tokens", () => {
  it("round-trip the claims", async () => {
    const token = await signBoardToken(privateKey, { userId: "user_1", boardId, role: "member" });
    expect(await verifyBoardToken(publicKey, token, boardId)).toEqual({
      userId: "user_1",
      boardId,
      role: "member",
    });
  });

  it("are only valid for the board they were issued for", async () => {
    const token = await signBoardToken(privateKey, { userId: "user_1", boardId, role: "owner" });
    expect(await verifyBoardToken(publicKey, token, otherBoard)).toBeNull();
  });

  it("expire", async () => {
    const issued = new Date("2026-11-08T12:00:00Z");
    const token = await signBoardToken(
      privateKey,
      { userId: "user_1", boardId, role: "member" },
      issued,
    );
    const justBefore = new Date(issued.getTime() + (REALTIME_TOKEN_TTL_SECONDS - 1) * 1000);
    const after = new Date(issued.getTime() + (REALTIME_TOKEN_TTL_SECONDS + 60) * 1000);
    expect(await verifyBoardToken(publicKey, token, boardId, justBefore)).not.toBeNull();
    expect(await verifyBoardToken(publicKey, token, boardId, after)).toBeNull();
  });

  it("reject tokens signed with another key", async () => {
    const token = await signBoardToken(strangerKey, { userId: "user_1", boardId, role: "owner" });
    expect(await verifyBoardToken(publicKey, token, boardId)).toBeNull();
  });

  it("reject tampered payloads", async () => {
    const token = await signBoardToken(privateKey, { userId: "user_1", boardId, role: "viewer" });
    const [header, payload, signature] = token.split(".") as [string, string, string];
    // JWT payloads here are plain ASCII JSON.
    const claims = JSON.parse(String.fromCharCode(...base64url.decode(payload)));
    const promoted = base64url.encode(JSON.stringify({ ...claims, role: "owner" }));
    expect(
      await verifyBoardToken(publicKey, `${header}.${promoted}.${signature}`, boardId),
    ).toBeNull();
  });

  it("reject unknown roles even when correctly signed", async () => {
    const token = await new SignJWT({ board: boardId, role: "admin" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer("planwerk-web")
      .setAudience("planwerk-realtime")
      .setSubject("user_1")
      .setExpirationTime("5m")
      .sign(await importJWK(privateKey, "ES256"));
    expect(await verifyBoardToken(publicKey, token, boardId)).toBeNull();
  });

  it("reject garbage without throwing", async () => {
    expect(await verifyBoardToken(publicKey, "not-a-token", boardId)).toBeNull();
    expect(await verifyBoardToken(publicKey, "", boardId)).toBeNull();
  });
});

describe("parseJwk", () => {
  it("parses JSON keys and rejects everything else", () => {
    expect(parseJwk(JSON.stringify({ kty: "EC", crv: "P-256" }))).toEqual({
      kty: "EC",
      crv: "P-256",
    });
    expect(parseJwk(undefined)).toBeNull();
    expect(parseJwk("")).toBeNull();
    expect(parseJwk("{not json")).toBeNull();
    expect(parseJwk('"just a string"')).toBeNull();
  });
});
