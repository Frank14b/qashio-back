import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@/modules/users/users.module';
import { ConfirmChangePasswordUseCase } from './application/confirm-change-password.use-case';
import { ConfirmPasswordResetUseCase } from './application/confirm-password-reset.use-case';
import { LoginUserUseCase } from './application/login-user.use-case';
import { LogoutSessionUseCase } from './application/logout-session.use-case';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { RequestChangePasswordUseCase } from './application/request-change-password.use-case';
import { RequestPasswordResetUseCase } from './application/request-password-reset.use-case';
import { VerifyEmailUseCase } from './application/verify-email.use-case';
import { AUTH_SESSION_REPOSITORY } from './domain/ports/auth-session.repository.port';
import { OTP_SERVICE } from './domain/ports/otp.port';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port';
import { TOKEN_SERVICE } from './domain/ports/token.service.port';
import { BcryptPasswordHasher } from './infrastructure/crypto/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/crypto/jwt-token.service';
import { RedisOtpService } from './infrastructure/otp/redis-otp.service';
import { AuthSessionOrmEntity } from './infrastructure/persistence/auth-session.orm-entity';
import { TypeOrmAuthSessionRepository } from './infrastructure/persistence/typeorm-auth-session.repository';
import { AuthController } from './presentation/http/auth.controller';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([AuthSessionOrmEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as `${number}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    VerifyEmailUseCase,
    LoginUserUseCase,
    RefreshSessionUseCase,
    LogoutSessionUseCase,
    RequestPasswordResetUseCase,
    ConfirmPasswordResetUseCase,
    RequestChangePasswordUseCase,
    ConfirmChangePasswordUseCase,
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: TypeOrmAuthSessionRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    {
      provide: OTP_SERVICE,
      useClass: RedisOtpService,
    },
  ],
})
export class AuthModule {}
