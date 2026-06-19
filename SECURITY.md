# Security Policy

## Supported Versions

| Version       | Supported                        |
| ------------- | -------------------------------- |
| `main` branch | ✅ Actively maintained           |
| Older tags    | ❌ Not supported — please update |

---

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in EcoTrack AI, please **do not** open a public GitHub Issue.

Instead, report it via one of the following private channels:

1. **GitHub Security Advisories** (preferred): [Open a private advisory](../../security/advisories/new)
2. **Email**: Contact the repository maintainer privately (see GitHub profile).

Please include:

- A clear description of the vulnerability and the attack vector
- Steps to reproduce (or a minimal proof-of-concept)
- The potential impact and severity assessment
- Any suggested remediation

We aim to acknowledge reports within **48 hours** and provide a fix or mitigation within **7 days** for critical issues.

---

## Security Architecture

EcoTrack AI implements the following security controls:

### Authentication & Authorization

- **JWT Bearer token** authentication (HS256) via `jsonwebtoken`
- `AUTH_REQUIRED=true` enforces strict authentication on all API routes (rejects tokenless requests with HTTP 401)
- Default stub user fallback is **disabled in production** automatically
- `JWT_SECRET` must be set as an environment variable — the server hard-fails at startup in production if absent

### Transport Security

- **HSTS** (HTTP Strict Transport Security) with 1-year `max-age`, `includeSubDomains`, and `preload`
- All HTTP responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Content Security Policy (CSP)

- `default-src 'self'` — no inline scripts, no `eval()`
- `script-src 'self'` — no CDN scripts
- `object-src 'none'` — no Flash or plugins
- `frame-ancestors 'none'` — clickjacking protection
- `upgrade-insecure-requests` — forces HTTPS

### Permissions Policy

- All sensitive browser APIs restricted: `camera=(), microphone=(), geolocation=(), payment=(), usb=()`

### CSRF Protection

- **Double-submit cookie pattern**: `csrfToken` HTTP-only cookie validated against `X-CSRF-Token` request header
- CSRF tokens expire after **2 hours** (`maxAge: 7200s`)
- Tokens are `crypto.randomBytes(32)` — 256 bits of entropy

### Input Validation & Sanitization

- All API inputs validated with **Zod** schemas (type, range, format checks)
- XSS sanitizer middleware strips: `<script>`, `<style>`, HTML tags, `javascript:`, `data:`, inline event handlers, SVG events, null bytes, and prototype pollution keys
- HTML entity decoding is applied before sanitization to catch encoded bypass attempts
- All SQL queries use **parameterized statements only** (no string interpolation) — CWE-89 mitigated

### Rate Limiting

- General API: 100 requests / 15 minutes
- Write operations (POST): 20 requests / minute
- AI chat: 10 requests / minute

### Error Handling

- Error responses never include stack traces or internal details in production
- React `ErrorBoundary` displays only generic user-facing messages — never raw `error.message`
- Global Express error handler suppresses `err.stack` in production

### Password Security

- Default seed user password stored as **Argon2id** hash (industry best practice)
- Hash loaded from `SEED_USER_PASSWORD_HASH` environment variable — never hardcoded in source
- In production without the env var set, account is locked with a random placeholder hash

### Docker Security

- Multi-stage build: devDependencies pruned from production image
- Runs as **non-root user** (`ecotrack`) — no root privilege escalation
- Health check endpoint validated at container startup
- SQLite database file excluded from Docker build context

---

## Required Environment Variables (Production)

| Variable                     | Required                 | Description                                                        |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `JWT_SECRET`                 | **Required**             | Minimum 32-character random string. Server exits if missing.       |
| `AUTH_REQUIRED`              | **Strongly recommended** | Set to `true` to enforce JWT on all routes                         |
| `SEED_USER_PASSWORD_HASH`    | Recommended              | Argon2id hash for default user. Random placeholder used if absent. |
| `DATABASE_URL`               | Recommended              | PostgreSQL connection string. Falls back to SQLite if absent.      |
| `DB_SSL_REJECT_UNAUTHORIZED` | Optional                 | Set to `false` only for self-signed cert test environments         |
| `CLIENT_ORIGIN`              | Optional                 | CORS allowed origin (default: `http://localhost:5173`)             |

---

## Dependency Security

- `npm audit` is run on every dependency update — 0 known vulnerabilities at time of release
- `package-lock.json` is committed to ensure reproducible, locked dependency trees
- Docker build uses `npm ci --ignore-scripts` to prevent malicious install scripts

---

## Acknowledgements

Security improvements are welcomed. Contributors who responsibly disclose valid vulnerabilities will be credited in the project changelog.
