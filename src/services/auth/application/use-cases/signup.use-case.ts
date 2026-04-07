// src/services/auth/application/use-cases/signup.use-case.ts
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@shared/errors/AppError';
import { eventBus, Events } from '@infrastructure/events/eventBus';
import { getQueue, QUEUES } from '@infrastructure/queue';
import type { EmailJobData } from '@infrastructure/queue';
import { createLogger } from '@infrastructure/logger';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import type { SignupDto, SignupResponse } from '../dtos/auth.dto';

const log = createLogger('SignupUseCase');

export class SignupUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: SignupDto): Promise<SignupResponse> {
    const exists = await this.userRepository.existsByEmail(dto.email);
    if (exists) throw AppError.conflict('An account with this email already exists');

    // Argon2id — OWASP recommended: 64 MiB, 3 iterations
    const passwordHash = await argon2.hash(dto.password, {
      type:        argon2.argon2id,
      memoryCost:  65536,
      timeCost:    3,
      parallelism: 4,
    });

    const emailVerifyToken  = uuidv4();
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.userRepository.create({
      email:    dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName:  dto.lastName,
      emailVerifyToken,
      emailVerifyExpiry,
    });

    await getQueue<EmailJobData>(QUEUES.EMAIL).add('send-verification', {
      type:    'VERIFY_EMAIL',
      to:      user.email,
      payload: { name: user.firstName, token: emailVerifyToken },
    });

    eventBus.publish(Events.USER_REGISTERED, {
      userId: user.id,
      email:  user.email,
      role:   user.role,
    });

    log.info({ userId: user.id }, 'User registered');

    return {
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
      },
      message: 'Account created. Please check your email to verify your account.',
    };
  }
}
