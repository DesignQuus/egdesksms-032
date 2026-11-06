// 로그인 세션·CSRF 순수 로직 테스트. 실행: node --experimental-strip-types --test scripts/test/security-core.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  LoginRateLimiter, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, SESSION_TOUCH_MS, hashToken, isOriginAllowed,
  isSafeMethod, newToken, nextExpiry, shouldTouch, tokensEqual,
} from "../../src/lib/security/core.ts";

test("tokens are random, url-safe and stored only as a hash", () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a), hashToken(a));
});

test("token comparison is exact", () => {
  assert.equal(tokensEqual("abc", "abc"), true);
  assert.equal(tokensEqual("abc", "abd"), false);
  assert.equal(tokensEqual("abc", "abcd"), false);
  assert.equal(tokensEqual(null, "abc"), false);
  assert.equal(tokensEqual("", ""), false);
});

test("only GET/HEAD/OPTIONS are safe", () => {
  for (const m of ["GET", "head", "OPTIONS"]) assert.equal(isSafeMethod(m), true);
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(isSafeMethod(m), false);
});

test("session expiry slides with use but never passes the absolute lifetime", () => {
  const created = 1_000_000;
  assert.equal(nextExpiry(created, created), created + SESSION_IDLE_MS);
  const late = created + SESSION_ABSOLUTE_MS - 60_000;
  assert.equal(nextExpiry(late, created), created + SESSION_ABSOLUTE_MS);
  assert.equal(shouldTouch(created, created + SESSION_TOUCH_MS - 1), false);
  assert.equal(shouldTouch(created, created + SESSION_TOUCH_MS), true);
});

test("CSRF origin check accepts this server, forwarded host and tunnel; rejects others", () => {
  const base = { requestOrigin: "http://localhost:4004", referer: null };
  assert.equal(isOriginAllowed({ ...base, origin: "http://localhost:4004" }), true);
  assert.equal(isOriginAllowed({ ...base, origin: "https://evil.example" }), false);
  assert.equal(isOriginAllowed({ ...base, origin: "null" }), false);
  assert.equal(isOriginAllowed({ ...base, origin: "not a url" }), false);
  // 출처 정보가 없는 서버 간 호출은 통과(로그인 세션 요청은 토큰을 따로 검사)
  assert.equal(isOriginAllowed({ ...base, origin: null }), true);
  // Origin 이 없으면 Referer 로 판단
  assert.equal(isOriginAllowed({ ...base, origin: null, referer: "https://evil.example/page" }), false);
  assert.equal(isOriginAllowed({ ...base, origin: null, referer: "http://localhost:4004/orders" }), true);
  // 터널·프록시
  assert.equal(isOriginAllowed({
    ...base, origin: "https://tunneling-service.onrender.com",
    extraOrigins: ["https://tunneling-service.onrender.com/t/abc"],
  }), true);
  assert.equal(isOriginAllowed({
    ...base, origin: "https://sms.example.com", forwardedHost: "sms.example.com", forwardedProto: "https",
  }), true);
  assert.equal(isOriginAllowed({ ...base, origin: "https://a.example", extraOrigins: ["https://b.example, https://a.example"] }), true);
});

test("login limiter blocks after 5 failures within 15 minutes and resets on success", () => {
  const limiter = new LoginRateLimiter(5, 15 * 60 * 1000);
  const t0 = 0;
  for (let i = 0; i < 4; i++) limiter.fail("ip|admin", t0 + i);
  assert.equal(limiter.blockedFor("ip|admin", t0 + 10), 0);
  limiter.fail("ip|admin", t0 + 10);
  assert.ok(limiter.blockedFor("ip|admin", t0 + 20) > 0);
  assert.equal(limiter.blockedFor("other|admin", t0 + 20), 0);
  assert.equal(limiter.blockedFor("ip|admin", t0 + 15 * 60 * 1000 + 1), 0);
  limiter.fail("ip|x", 0);
  limiter.succeed("ip|x");
  assert.equal(limiter.blockedFor("ip|x", 1), 0);
});
