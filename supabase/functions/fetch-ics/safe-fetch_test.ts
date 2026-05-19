// Run with:  deno test supabase/functions/fetch-ics/safe-fetch_test.ts
//
// These tests cover the URL / IP allow-list helpers. Network-dependent paths
// (`safeFetch` proper) aren't exercised here; the helpers below are the
// SSRF-critical surface.

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSafeUrl,
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6,
  parseIPv4,
  parseIPv6,
  SafeFetchError,
} from "./safe-fetch.ts";

// ---------- parseIPv4 ----------

Deno.test("parseIPv4 accepts well-formed addresses", () => {
  assertEquals(parseIPv4("0.0.0.0"), [0, 0, 0, 0]);
  assertEquals(parseIPv4("8.8.8.8"), [8, 8, 8, 8]);
  assertEquals(parseIPv4("255.255.255.255"), [255, 255, 255, 255]);
});

Deno.test("parseIPv4 rejects malformed input", () => {
  assertEquals(parseIPv4("1.2.3"), null);
  assertEquals(parseIPv4("1.2.3.4.5"), null);
  assertEquals(parseIPv4("256.0.0.0"), null);
  assertEquals(parseIPv4("1.2.3.a"), null);
  assertEquals(parseIPv4(""), null);
});

// ---------- isPrivateIPv4 ----------

Deno.test("isPrivateIPv4 flags RFC1918, loopback, link-local, and the cloud metadata IP", () => {
  // RFC1918
  assertEquals(isPrivateIPv4("10.0.0.1"), true);
  assertEquals(isPrivateIPv4("172.16.0.1"), true);
  assertEquals(isPrivateIPv4("172.31.255.254"), true);
  assertEquals(isPrivateIPv4("192.168.1.1"), true);
  // loopback
  assertEquals(isPrivateIPv4("127.0.0.1"), true);
  // link-local incl. the AWS/GCE/Azure metadata IP
  assertEquals(isPrivateIPv4("169.254.0.1"), true);
  assertEquals(isPrivateIPv4("169.254.169.254"), true);
  // CGNAT
  assertEquals(isPrivateIPv4("100.64.0.1"), true);
  // 0.0.0.0/8
  assertEquals(isPrivateIPv4("0.0.0.0"), true);
  // multicast + reserved
  assertEquals(isPrivateIPv4("224.0.0.1"), true);
  assertEquals(isPrivateIPv4("255.255.255.255"), true);
});

Deno.test("isPrivateIPv4 allows public addresses", () => {
  assertEquals(isPrivateIPv4("8.8.8.8"), false);
  assertEquals(isPrivateIPv4("1.1.1.1"), false);
  assertEquals(isPrivateIPv4("172.15.0.1"), false); // just outside 172.16/12
  assertEquals(isPrivateIPv4("172.32.0.1"), false); // just outside 172.16/12
  assertEquals(isPrivateIPv4("169.253.1.1"), false); // just outside link-local
});

// ---------- parseIPv6 ----------

Deno.test("parseIPv6 expands :: shorthand correctly", () => {
  assertEquals(parseIPv6("::1"), [0, 0, 0, 0, 0, 0, 0, 1]);
  assertEquals(parseIPv6("::"), [0, 0, 0, 0, 0, 0, 0, 0]);
  assertEquals(parseIPv6("fe80::1"), [0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  assertEquals(parseIPv6("2001:db8::1"), [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
});

Deno.test("parseIPv6 handles IPv4-mapped form", () => {
  const g = parseIPv6("::ffff:127.0.0.1");
  assertEquals(g, [0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001]);
});

Deno.test("parseIPv6 rejects garbage", () => {
  assertEquals(parseIPv6(":::"), null);
  assertEquals(parseIPv6("gggg::1"), null);
  assertEquals(parseIPv6("1::2::3"), null);
  assertEquals(parseIPv6("1:2:3:4:5:6:7:8:9"), null);
});

// ---------- isPrivateIPv6 ----------

Deno.test("isPrivateIPv6 flags loopback, unspecified, ULA, link-local, multicast", () => {
  assertEquals(isPrivateIPv6("::"), true);
  assertEquals(isPrivateIPv6("::1"), true);
  assertEquals(isPrivateIPv6("fc00::1"), true);
  assertEquals(isPrivateIPv6("fd12:3456:789a::1"), true);
  assertEquals(isPrivateIPv6("fe80::1"), true);
  assertEquals(isPrivateIPv6("ff02::1"), true);
});

Deno.test("isPrivateIPv6 re-checks IPv4-mapped addresses", () => {
  // ::ffff:127.0.0.1 must be rejected (loopback under the v4 hood)
  assertEquals(isPrivateIPv6("::ffff:127.0.0.1"), true);
  // ::ffff:169.254.169.254 must be rejected (metadata under the v4 hood)
  assertEquals(isPrivateIPv6("::ffff:169.254.169.254"), true);
  // ::ffff:8.8.8.8 is public and should be allowed
  assertEquals(isPrivateIPv6("::ffff:8.8.8.8"), false);
});

Deno.test("isPrivateIPv6 allows public global-unicast addresses", () => {
  assertEquals(isPrivateIPv6("2606:4700:4700::1111"), false); // Cloudflare DNS
  assertEquals(isPrivateIPv6("2001:4860:4860::8888"), false); // Google DNS
});

// ---------- isPrivateAddress (entry point used by assertHostnameSafe) ----------

Deno.test("isPrivateAddress dispatches on colon presence", () => {
  assertEquals(isPrivateAddress("127.0.0.1"), true);
  assertEquals(isPrivateAddress("::1"), true);
  assertEquals(isPrivateAddress("8.8.8.8"), false);
  assertEquals(isPrivateAddress("2606:4700:4700::1111"), false);
});

// ---------- assertSafeUrl ----------

Deno.test("assertSafeUrl rejects non-http(s) schemes", () => {
  assertThrows(
    () => assertSafeUrl("file:///etc/passwd"),
    SafeFetchError,
    "http(s)",
  );
  assertThrows(
    () => assertSafeUrl("ftp://example.com/cal.ics"),
    SafeFetchError,
    "http(s)",
  );
  assertThrows(
    () => assertSafeUrl("gopher://example.com/"),
    SafeFetchError,
    "http(s)",
  );
});

Deno.test("assertSafeUrl rejects bad ports but allows 80/443/none", () => {
  assertThrows(
    () => assertSafeUrl("http://example.com:22/x.ics"),
    SafeFetchError,
    "ports 80 and 443",
  );
  assertThrows(
    () => assertSafeUrl("http://example.com:6379/"),
    SafeFetchError,
    "ports 80 and 443",
  );
  // Allowed ports — no throw
  assertSafeUrl("http://example.com:80/x.ics");
  assertSafeUrl("https://example.com:443/x.ics");
  assertSafeUrl("https://example.com/x.ics");
});

Deno.test("assertSafeUrl rejects embedded credentials", () => {
  assertThrows(
    () => assertSafeUrl("https://user:pass@example.com/x.ics"),
    SafeFetchError,
    "credentials",
  );
});

Deno.test("assertSafeUrl rejects unparsable input", () => {
  assertThrows(() => assertSafeUrl(""), SafeFetchError, "Invalid URL");
  assertThrows(() => assertSafeUrl("not a url"), SafeFetchError, "Invalid URL");
});
