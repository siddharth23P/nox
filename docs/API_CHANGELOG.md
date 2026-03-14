# API Change Log

## v2.0.0 - Smart Outbox Support

- **CreateMessage** endpoint signature updated to include an optional `expires_at` field (ISO8601 timestamp) for message expiration.
- This is a breaking change; clients must be updated to send the new field when needed.
- Updated backend handlers and TypeScript store to handle `expires_at`.
