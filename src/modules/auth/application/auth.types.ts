export type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuthTokensResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

export type EmailVerificationPendingResult = {
  email: string;
  message: string;
  requiresEmailVerification: true;
};

export type OtpSentResult = {
  message: string;
};

/** OTP sent and bound to this client: `otpToken` must accompany the code on confirm. */
export type BoundOtpSentResult = OtpSentResult & {
  otpToken: string;
};
