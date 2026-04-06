import crypto from 'crypto';
import { db } from '../db';
import { passwordResetTokens, users } from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export class ResetService {
  /**
   * Generate a cryptographically secure reset token (32 bytes)
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Request a password reset by generating and storing a token
   * @param email - User's email address
   * @returns The generated token (to be sent via email)
   */
  async requestReset(email: string): Promise<string | null> {
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Return null but don't reveal if email exists (security)
      return null;
    }

    // Generate secure token
    const token = this.generateToken();
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token in database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    return token;
  }

  /**
   * Validate a reset token
   * @param token - The reset token to validate
   * @returns Object with validation result and userId if valid
   */
  async validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const now = new Date();

    // Find token that is not expired and not used
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, now),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!resetToken) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: resetToken.userId,
    };
  }

  /**
   * Mark a token as used
   * @param token - The token to mark as used
   */
  async markTokenAsUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  /**
   * Invalidate all reset tokens for a user
   * @param userId - The user's ID
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt)
        )
      );
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < ${now}`);
  }
}

export const resetService = new ResetService();
