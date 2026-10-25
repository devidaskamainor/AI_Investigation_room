import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from '../../../shared/schemas/index.js';
import { csrfToken } from '../middleware/security.js';
import { ok, AppError } from '../middleware/errors.js';
import { profileDto } from '../services/mystery/dto.js';
import * as auth from '../services/auth/auth.service.js';
export function authController(env, { emailProvider = auth.developmentEmail(env) } = {}) {
  async function establish(req, user) {
    await new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.userId = String(user._id);
    return { user: profileDto(user), csrfToken: csrfToken(req) };
  }
  return {
    csrf: (req, res) => ok(res, { csrfToken: csrfToken(req) }),
    register: async (req, res) =>
      ok(res, await establish(req, await auth.register(registerSchema.parse(req.body))), 201),
    login: async (req, res) =>
      ok(res, await establish(req, await auth.login(loginSchema.parse(req.body)))),
    logout: async (req, res) => {
      await new Promise((resolve, reject) =>
        req.session.destroy((error) => (error ? reject(error) : resolve())),
      );
      res.clearCookie('mr.sid', {
        path: '/',
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      });
      ok(res, {});
    },
    me: async (req, res) => {
      const user = await auth.getUser(req.userId);
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please sign in again.');
      ok(res, { user: profileDto(user), csrfToken: csrfToken(req) });
    },
    forgot: async (req, res) => {
      await auth.forgotPassword(forgotSchema.parse(req.body).email, env, emailProvider);
      ok(res, { message: 'If an account exists, a password reset link has been sent.' });
    },
    reset: async (req, res) => {
      await auth.resetPassword(resetSchema.parse(req.body), env);
      ok(res, { message: 'Password updated. You can sign in now.' });
    },
  };
}
