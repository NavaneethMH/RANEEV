# Notification Provider Reference

The default RANEEV provider is the persisted **demo** in-app provider. It must remain fully functional with no Twilio credential and is the only provider exercised in development.

The optional Twilio adapter is server-side only. The reviewed Twilio Create Message operation is `POST /2010-04-01/Accounts/{AccountSid}/Messages.json` using form-encoded fields. Its required values are the account SID path value and recipient `To`; an SMS sender may be supplied through `From`. The response includes an optional `sid` and delivery `status`, which may be stored as provider metadata. The implementation must use only minimized generic SMS text, avoid medical or identity details, and store failed delivery separately while retaining in-app delivery.

Configuration is intentionally defaulted to `demo`. Twilio mode requires all three optional server-side variables—`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`—and must return an auditable failed SMS record rather than affecting incident creation, matching, navigation, escalation, arrival, or resolution when unavailable.

Source: Twilio Documentation MCP, Create Message operation `op::twilio_api_v2010::CreateMessage` (reviewed 2026-08-23).
