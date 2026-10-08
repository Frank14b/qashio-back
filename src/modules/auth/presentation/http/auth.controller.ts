import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ActivityAction } from '@/modules/activity-logs/domain/activity-action.enum';
import { LogActivity } from '@/modules/activity-logs/presentation/decorators/log-activity.decorator';
import { ErrorResponseDto } from '@/shared/http/error-response.dto';
import { REFRESH_THROTTLE, STRICT_AUTH_THROTTLE } from '@/shared/rate-limit/rate-limit.module';
import { ConfirmChangePasswordUseCase } from '../../application/confirm-change-password.use-case';
import { ConfirmPasswordResetUseCase } from '../../application/confirm-password-reset.use-case';
import { LoginUserUseCase } from '../../application/login-user.use-case';
import { LogoutSessionUseCase } from '../../application/logout-session.use-case';
import { RefreshSessionUseCase } from '../../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../../application/register-user.use-case';
import { RequestChangePasswordUseCase } from '../../application/request-change-password.use-case';
import { RequestPasswordResetUseCase } from '../../application/request-password-reset.use-case';
import { VerifyEmailUseCase } from '../../application/verify-email.use-case';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { ConfirmChangePasswordRequestDto } from './dto/confirm-change-password-request.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { OtpSentResponseDto } from './dto/otp-sent-response.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { RegisterPendingResponseDto } from './dto/register-pending-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { VerifyEmailRequestDto } from './dto/verify-email-request.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly verifyEmail: VerifyEmailUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutSession: LogoutSessionUseCase,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    private readonly confirmPasswordReset: ConfirmPasswordResetUseCase,
    private readonly requestChangePassword: RequestChangePasswordUseCase,
    private readonly confirmChangePassword: ConfirmChangePasswordUseCase,
  ) {}

  @Post('register')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @LogActivity({
    action: ActivityAction.AUTH_REGISTER,
    resourceType: 'user',
    resourceIdFrom: 'email',
  })
  @ApiOperation({
    summary: 'Register a new user (inactive until email OTP is verified)',
  })
  @ApiCreatedResponse({ type: RegisterPendingResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email is already registered',
  })
  register(@Body() body: RegisterRequestDto, @Req() req: Request) {
    return this.registerUser.execute({
      ...body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('verify-email')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_VERIFY_EMAIL,
    resourceType: 'user',
    userIdFrom: 'user.id',
    resourceIdFrom: 'user.id',
  })
  @ApiOperation({ summary: 'Verify signup email OTP and open a session' })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  verifyEmailEndpoint(@Body() body: VerifyEmailRequestDto, @Req() req: Request) {
    return this.verifyEmail.execute({
      ...body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('login')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_LOGIN,
    resourceType: 'user',
    userIdFrom: 'user.id',
    resourceIdFrom: 'user.id',
  })
  @ApiOperation({ summary: 'Login and open a session (verified users only)' })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid credentials or unverified email',
  })
  login(@Body() body: LoginRequestDto, @Req() req: Request) {
    return this.loginUser.execute({
      ...body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('refresh')
  @Throttle(REFRESH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_REFRESH,
    resourceType: 'user',
    userIdFrom: 'user.id',
    resourceIdFrom: 'user.id',
  })
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid refresh token',
  })
  refresh(@Body() body: RefreshRequestDto, @Req() req: Request) {
    return this.refreshSession.execute({
      refreshToken: body.refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('logout')
  @HttpCode(204)
  @LogActivity({
    action: ActivityAction.AUTH_LOGOUT,
    resourceType: 'auth_session',
    userIdFrom: 'userId',
    resourceIdFrom: 'sessionId',
    emptyResponse: true,
  })
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid refresh token',
  })
  logout(@Body() body: RefreshRequestDto, @Req() req: Request) {
    return this.logoutSession.execute({
      refreshToken: body.refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('forgot-password')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_FORGOT_PASSWORD,
    resourceType: 'user',
  })
  @ApiOperation({
    summary: 'Request a password-reset OTP by email; returns the otpToken required to confirm it',
  })
  @ApiOkResponse({ type: OtpSentResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    return this.requestPasswordReset.execute(body);
  }

  @Post('reset-password')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_RESET_PASSWORD,
    resourceType: 'user',
  })
  @ApiOperation({ summary: 'Confirm password reset with OTP and new password' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  resetPassword(@Body() body: ResetPasswordRequestDto) {
    return this.confirmPasswordReset.execute(body);
  }

  @Post('change-password/request')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_CHANGE_PASSWORD_REQUEST,
    resourceType: 'user',
  })
  @ApiOperation({
    summary: 'Request a change-password OTP (requires current password)',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  changePasswordRequest(@Body() body: ChangePasswordRequestDto) {
    return this.requestChangePassword.execute(body);
  }

  @Post('change-password/confirm')
  @Throttle(STRICT_AUTH_THROTTLE)
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @LogActivity({
    action: ActivityAction.AUTH_CHANGE_PASSWORD,
    resourceType: 'user',
  })
  @ApiOperation({ summary: 'Confirm password change with OTP and new password' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  changePasswordConfirm(@Body() body: ConfirmChangePasswordRequestDto) {
    return this.confirmChangePassword.execute(body);
  }
}
