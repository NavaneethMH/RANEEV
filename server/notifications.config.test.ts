import { describe, expect, it } from "vitest";
import { getNotificationConfig } from "./notifications/config";

describe("notification provider configuration", () => {
  it("defaults to fully functional demo delivery when optional Twilio credentials are absent", () => {
    const config = getNotificationConfig({});
    expect(config.provider).toBe("demo");
    expect(config.twilioConfigured).toBe(false);
    expect(config.responderSearchTimeoutSeconds).toBe(300);
  });

  it("requires all server-side Twilio credentials before SMS can be considered configured", () => {
    const incomplete = getNotificationConfig({ NOTIFICATION_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "ACexample" });
    const complete = getNotificationConfig({ NOTIFICATION_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "ACexample", TWILIO_AUTH_TOKEN: "secret", TWILIO_PHONE_NUMBER: "+15551234567" });
    expect(incomplete.provider).toBe("twilio");
    expect(incomplete.twilioConfigured).toBe(false);
    expect(complete.twilioConfigured).toBe(true);
  });
});
