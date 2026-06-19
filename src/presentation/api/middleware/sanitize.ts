/**
 * @security XSS Sanitizer Middleware
 *
 * Applies defence-in-depth input sanitization to all incoming request bodies, query strings,
 * and route params. Note: React already output-encodes all rendered values, so this acts as
 * a secondary server-side guard.
 *
 * Patterns defended:
 *  - <script> / <style> tag injection (CWE-79)
 *  - HTML tag stripping (angle brackets)
 *  - javascript: / data: URI protocols
 *  - Inline event handlers: onclick=, onerror=, onload= etc.
 *  - SVG/XML event handlers: <svg onload=...>, <body onfocus=...>
 *  - Null byte injection (CWE-158) — used to bypass file extension checks
 *  - Prototype pollution keys: __proto__, constructor, prototype (CWE-1321)
 *  - HTML entity encoded bypasses: &lt;script&gt; decoded then re-sanitized
 */
import { Request, Response, NextFunction } from 'express';

// Strip dangerous script/style blocks including their content
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_TAG_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
// Strip remaining HTML tags (angle brackets)
const HTML_TAG_RE = /<[^>]*>/g;
// Block dangerous URI protocols — replace only the protocol keyword
const JS_PROTOCOL_RE = /javascript\s*:/gi;
const DATA_PROTOCOL_RE = /data\s*:/gi;
// Strip inline event handlers (e.g. onerror=..., onclick=...)
const EVENT_HANDLER_RE = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;
// Strip SVG/XML event handlers that are not caught by the standard event handler regex
const SVG_EVENT_RE = /\s(?:onload|onfocus|onmouseover|onerror|onmouseenter|onanimationstart|onpointerover)\s*=/gi;
// Strip residual function calls with quoted string arguments (e.g. alert("xss"), alert('xss'), alert(`xss`))
const QUOTED_FUNC_CALL_RE = /\w+\([^)]*['"`][^)]*\)/g;
// Null byte injection — CWE-158: Improper Neutralization of Null Byte
// eslint-disable-next-line no-control-regex
const NULL_BYTE_RE = /\x00/g;
// HTML entity decode map for the most dangerous entities used to bypass regex sanitizers
const HTML_ENTITY_MAP: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&#x3C;': '<',
  '&#60;': '<',
  '&#x3E;': '>',
  '&#62;': '>',
  '&#x22;': '"',
  '&#34;': '"',
  '&#x27;': "'",
  '&#39;': "'",
};
const HTML_ENTITY_RE = /&(?:lt|gt|amp|#x3[CE]|#[36][024]|#x22|#x27);/gi;

/** Decode HTML entities that could be used to sneak past regex-based sanitizers. */
function decodeHtmlEntities(val: string): string {
  return val.replace(HTML_ENTITY_RE, (match) => HTML_ENTITY_MAP[match] ?? match);
}

export function sanitizeString(val: string): string {
  if (!val) return val;
  // First pass: decode HTML entities to reveal encoded payloads, then sanitize
  const decoded = decodeHtmlEntities(val);
  return decoded
    .replace(NULL_BYTE_RE, '') // null byte injection
    .replace(SCRIPT_TAG_RE, '')
    .replace(STYLE_TAG_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(SVG_EVENT_RE, '') // SVG/XML specific event attributes
    .replace(EVENT_HANDLER_RE, '')
    .replace(JS_PROTOCOL_RE, 'blocked:')
    .replace(DATA_PROTOCOL_RE, 'blocked:')
    .replace(QUOTED_FUNC_CALL_RE, '');
}

/** Prototype pollution guard — reject keys that could corrupt the JS prototype chain. */
const PROTO_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }
  if (data !== null && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      /**
       * @security CWE-1321 Prototype Pollution.
       * Skip keys that could overwrite Object.prototype or constructor.
       */
      if (PROTO_POLLUTION_KEYS.has(key)) continue;
      sanitized[key] = sanitizeData((data as Record<string, unknown>)[key]);
    }
    return sanitized;
  }
  return data;
}

export function xssSanitizer(req: Request, _res: Response, next: NextFunction): void {
  if (req.body !== undefined) {
    req.body = sanitizeData(req.body);
  }
  req.query = sanitizeData(req.query) as typeof req.query;
  req.params = sanitizeData(req.params) as typeof req.params;
  next();
}
