import bcrypt from 'bcryptjs';
import { randomBytes, createHmac } from 'node:crypto';
import { User } from '../../models/index.js';
import { AppError } from '../../middleware/errors.js';
const dummyHash = bcrypt.hashSync('unused-password-for-timing', 12);
export const getUser = (userId) => User.findById(userId);
export const tokenHash = (token, env) =>
  createHmac('sha256', env.PASSWORD_RESET_TOKEN_SECRET).update(token).digest('hex');
export async function register(input) {
  try {
    return await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
  } catch (e) {
    if (e.code === 11000)
      throw new AppError(
        409,
        'ACCOUNT_UNAVAILABLE',
        'Unable to create an account with these details. Try signing in or resetting your password.',
      );
    throw e;
  }
}
export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !matches)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return user;
}
export async function forgotPassword(email, env, emailProvider) {
  const user = await User.findOne({ email });
  if (!user) return;
  const token = randomBytes(32).toString('hex');
  user.resetTokenHash = tokenHash(token, env);
  user.resetExpiresAt = new Date(Date.now() + 1800000);
  await user.save();
  await emailProvider.sendReset(user.email, `${env.CLIENT_URL}/reset-password?token=${token}`);
}
export async function resetPassword({ token, password }, env) {
  const user = await User.findOneAndUpdate(
    { resetTokenHash: tokenHash(token, env), resetExpiresAt: { $gt: new Date() } },
    {
      $set: { passwordHash: await bcrypt.hash(password, 12) },
      $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
    },
  );
  if (!user)
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.');
}
export function developmentEmail(env) {
  return {
    async sendReset(_email, url) {
      if (env.NODE_ENV === 'development') console.info(`Development password reset: ${url}`);
    },
  };
}
