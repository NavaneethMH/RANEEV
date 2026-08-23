export type NotificationProviderName = "demo" | "twilio";

const normalized = (value: string | undefined) => value?.trim() ?? "";

export function getNotificationConfig(env: NodeJS.ProcessEnv = process.env) {
  const requestedProvider = normalized(env.NOTIFICATION_PROVIDER).toLowerCase();
  const provider: NotificationProviderName = requestedProvider === "twilio" ? "twilio" : "demo";
  const twilio = {
    accountSid: normalized(env.TWILIO_ACCOUNT_SID),
    authToken: normalized(env.TWILIO_AUTH_TOKEN),
    phoneNumber: normalized(env.TWILIO_PHONE_NUMBER),
  };
  return {
    provider,
    twilio,
    twilioConfigured: Boolean(twilio.accountSid && twilio.authToken && twilio.phoneNumber),
    responderSearchTimeoutSeconds: Math.max(60, Number.parseInt(normalized(env.RESPONDER_SEARCH_TIMEOUT_SECONDS) || "300", 10) || 300),
    escalationTimeoutSeconds: Math.max(60, Number.parseInt(normalized(env.ESCALATION_TIMEOUT_SECONDS) || "600", 10) || 600),
    criticalNotificationThresholdMinutes: Math.max(1, Number.parseInt(normalized(env.CRITICAL_NOTIFICATION_THRESHOLD_MINUTES) || "10", 10) || 10),
  } as const;
}
