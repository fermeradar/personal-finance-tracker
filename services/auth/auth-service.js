import { comparePassword } from '../../src/utils/auth.js';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor(userManager) {
    this.userManager = userManager;
  }

  async login({ email, password }) {
    const user = await this.userManager.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    return { token, user };
  }
}