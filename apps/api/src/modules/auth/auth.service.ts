import prisma from '../../config/db';
import { verifyPassword, hashPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { createAuditLog } from '../../services/audit.service';
import { AuthResponse, SafeUserDto, INDIAN_STATES_UTS } from '@reliefchain/shared-types';
import crypto from 'crypto';

const SELF_REGISTER_ROLES = ['DONOR'];
const APPLICATION_ROLES = ['NGO_ADMIN', 'SUPPLIER', 'WAREHOUSE_OPERATOR'];
const PROVISIONED_ROLES = ['SYSTEM_ADMIN', 'GOVERNMENT_AUTHORITY', 'AUDITOR', 'NGO_OPERATOR', 'RELIEF_OFFICER'];

/** Validate Indian mobile number: +91 followed by 10 digits starting with 6-9 */
function validateIndianPhone(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

/** Validate 6-digit Indian PIN code */
function validatePinCode(pin: string): boolean {
  return /^\d{6}$/.test(pin) && pin[0] !== '0';
}

/** Validate password strength: min 8 chars */
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await createAuditLog({
      action: 'LOGIN',
      entityType: 'User',
      status: 'Failure',
      metadata: { reason: 'User not found', email },
    });
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    await createAuditLog({
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      status: 'Failure',
      metadata: { reason: 'Incorrect password' },
    });
    throw new Error('Invalid credentials');
  }

  // Check account status
  if (user.status === 'PENDING') {
    throw new Error('Account is pending approval. Please wait for verification.');
  }
  if (user.status === 'REJECTED') {
    throw new Error('Account registration was rejected. Please contact support.');
  }
  if (user.status === 'SUSPENDED') {
    throw new Error('Account has been suspended. Please contact support.');
  }

  const safeUser: SafeUserDto = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  const token = signToken(safeUser);

  await createAuditLog({
    actorId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    status: 'Success',
  });

  return { token, user: safeUser };
};

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone?: string;
  role: string;
  organizationName?: string;
  state?: string;
  district?: string;
  city?: string;
  pinCode?: string;
}

export const registerUser = async (input: RegisterInput): Promise<{ message: string; status: string }> => {
  // Validate role is registrable
  if (PROVISIONED_ROLES.includes(input.role)) {
    throw new Error(`Role "${input.role}" cannot be self-registered. Contact an administrator.`);
  }
  if (!SELF_REGISTER_ROLES.includes(input.role) && !APPLICATION_ROLES.includes(input.role)) {
    throw new Error(`Invalid registration role: ${input.role}`);
  }

  // Validate passwords
  if (input.password !== input.confirmPassword) {
    throw new Error('Passwords do not match');
  }
  const pwErr = validatePassword(input.password);
  if (pwErr) throw new Error(pwErr);

  // Validate email
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('Invalid email address');
  }

  // Validate fullName
  if (!input.fullName || input.fullName.trim().length < 2) {
    throw new Error('Full name is required (minimum 2 characters)');
  }

  // Validate Indian phone if provided
  if (input.phone && !validateIndianPhone(input.phone)) {
    throw new Error('Phone must be a valid Indian mobile number (+91XXXXXXXXXX)');
  }

  // Validate PIN code if provided
  if (input.pinCode && !validatePinCode(input.pinCode)) {
    throw new Error('PIN code must be a valid 6-digit Indian PIN code');
  }

  // Validate State if provided
  if (input.state && !(INDIAN_STATES_UTS as readonly string[]).includes(input.state)) {
    throw new Error('State must be a valid Indian State or Union Territory');
  }

  // Check duplicate email
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const isSelfRegister = SELF_REGISTER_ROLES.includes(input.role);
  const accountStatus = isSelfRegister ? 'ACTIVE' : 'PENDING';

  let organizationId: string | undefined = undefined;

  // For application roles, create or link organization
  if (APPLICATION_ROLES.includes(input.role) && input.organizationName) {
    const org = await prisma.organization.create({
      data: {
        name: input.organizationName,
        type: input.role === 'NGO_ADMIN' ? 'NGO' : input.role === 'SUPPLIER' ? 'SUPPLIER' : 'NGO',
        isVerified: false,
      }
    });
    organizationId = org.id;
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      fullName: input.fullName.trim(),
      phone: input.phone || null,
      status: accountStatus,
      organizationId: organizationId || null,
      state: input.state || null,
      district: input.district || null,
      city: input.city || null,
      pinCode: input.pinCode || null,
    }
  });

  await createAuditLog({
    actorId: user.id,
    action: 'REGISTER',
    entityType: 'User',
    entityId: user.id,
    status: 'Success',
    metadata: { role: input.role, accountStatus },
  });

  if (isSelfRegister) {
    return { message: 'Account created successfully. You can now sign in.', status: 'ACTIVE' };
  } else {
    return { message: 'Application submitted. Your account is pending approval by an administrator.', status: 'PENDING' };
  }
};

export const requestPasswordReset = async (email: string): Promise<{ message: string; resetToken?: string }> => {
  // Always return generic message for privacy
  const genericMessage = 'If an account with that email exists, a password reset link has been sent.';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: genericMessage };
  }

  // Generate cryptographically secure token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: resetTokenHash,
      resetTokenHash: resetTokenHash,
      resetTokenExp,
    }
  });

  await createAuditLog({
    actorId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    status: 'Success',
  });

  // In local dev, return the token directly for testability
  // In production, this would send an email through the notification service
  return { message: genericMessage, resetToken };
};

export const resetPassword = async (token: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> => {
  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }
  const pwErr = validatePassword(newPassword);
  if (pwErr) throw new Error(pwErr);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExp: { gt: new Date() },
    }
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenHash: null,
      resetTokenExp: null,
    }
  });

  await createAuditLog({
    actorId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: user.id,
    status: 'Success',
  });

  return { message: 'Password has been reset successfully. You can now sign in with your new password.' };
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> => {
  if (newPassword !== confirmPassword) {
    throw new Error('New passwords do not match');
  }
  const pwErr = validatePassword(newPassword);
  if (pwErr) throw new Error(pwErr);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    await createAuditLog({
      actorId: userId,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: userId,
      status: 'Failure',
      metadata: { reason: 'Incorrect current password' },
    });
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  await createAuditLog({
    actorId: userId,
    action: 'PASSWORD_CHANGE',
    entityType: 'User',
    entityId: userId,
    status: 'Success',
  });

  return { message: 'Password changed successfully.' };
};

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) throw new Error('User not found');

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    status: user.status,
    state: user.state,
    district: user.district,
    city: user.city,
    pinCode: user.pinCode,
    organizationId: user.organizationId,
    organization: user.organization ? {
      id: user.organization.id,
      name: user.organization.name,
      type: user.organization.type,
      isVerified: user.organization.isVerified,
    } : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
};
