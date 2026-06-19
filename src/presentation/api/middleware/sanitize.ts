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
// Strip residual function calls with quoted string arguments (e.g. alert("xss"), alert('xss'), alert(`xss`))
const QUOTED_FUNC_CALL_RE = /\w+\([^)]*['"`][^)]*\)/g;

export function sanitizeString(val: string): string {
  if (!val) return val;
  return val
    .replace(SCRIPT_TAG_RE, '')
    .replace(STYLE_TAG_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(JS_PROTOCOL_RE, 'blocked:')
    .replace(DATA_PROTOCOL_RE, 'blocked:')
    .replace(QUOTED_FUNC_CALL_RE, '');
}

function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (data !== null && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      sanitized[key] = sanitizeData((data as Record<string, unknown>)[key]);
    }
    return sanitized;
  }
  return data;
}

export function xssSanitizer(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = sanitizeData(req.body);
  }
  if (req.query) {
    req.query = sanitizeData(req.query) as typeof req.query;
  }
  if (req.params) {
    req.params = sanitizeData(req.params) as typeof req.params;
  }
  next();
}
