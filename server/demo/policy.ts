import type { User } from "../../drizzle/schema";

export const demoActorEmails = ["citizen.demo@raneev.test", "volunteer.demo@raneev.test", "coordinator.demo@raneev.test", "admin.demo@raneev.test"] as const;
export const demoPresenterEmails = ["coordinator.demo@raneev.test", "admin.demo@raneev.test"] as const;

export function isDemoActor(user: User) {
  return demoActorEmails.includes(user.email.toLowerCase() as (typeof demoActorEmails)[number]);
}

export function isDemoPresenter(user: User) {
  return demoPresenterEmails.includes(user.email.toLowerCase() as (typeof demoPresenterEmails)[number]) && ["coordinator", "admin"].includes(user.role);
}
