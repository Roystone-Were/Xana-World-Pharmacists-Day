// --- Xana World Pharmacists Day Walk: site config ---
// 1. Put the organizer's email below. Every registration is emailed there.
// 2. First time you use FormSubmit, it sends an activation email to that
//    inbox. Click "Activate" once and all later sign-ups flow straight in.
// 3. Redeploy (Vercel) after editing this file.

window.XANA_WALK_CONFIG = {
  organizerEmail: "roystone@xanalife.com", // test inbox

  eventName: "Xana World Pharmacists Day Walk",
  eventDateLabel: "Saturday, 26 September 2026",
  eventOccasion: "In celebration of World Pharmacists Day (Friday, 25 September 2026)",
  assembleTime: "Arrive 6:00 AM · Walk starts 6:30 AM",
  startPoint: "TRM Mall",
  finishPoint: "Xana Plus, Ruiru",

  // Registration deadline (Africa/Nairobi time).
  // Wednesday 23 Sept 2026, 9:00 PM EAT (before the Saturday walk).
  registrationDeadlineISO: "2026-09-23T21:00:00+03:00",
  registrationDeadlineLabel: "Wednesday 23 Sept · 9:00 PM EAT",

  formSubject: "New registration: Xana World Pharmacists Day Walk",
};
