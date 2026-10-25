import pino from 'pino';
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: ['req.headers', 'res.headers', 'password', 'token', 'apiKey', 'solution', 'prompt'],
    censor: '[redacted]',
  },
});
