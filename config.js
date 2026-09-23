// --- Xana World Pharmacists Day Walk: site config ---
// 1. Put the organizer's email below. Every registration is emailed there.
// 2. First time you use FormSubmit, it sends an activation email to that
//    inbox. Click "Activate" once and all later sign-ups flow straight in.
// 3. Redeploy (Vercel) after editing this file.

window.XANA_WALK_CONFIG = {
  organizerEmail: "joywincate@xanalife.com",

  eventName: "Xana World Pharmacists Day Walk",
  eventDateLabel: "Saturday, 26 September 2026",
  eventOccasion: "In celebration of World Pharmacists Day (Friday, 25 September 2026)",
  assembleTime: "Arrive 6:00 AM · Walk starts 6:30 AM",
  startPoint: "TRM Mall",
  finishPoint: "Xana Plus, Ruiru",

  // Registration switch. false = closed, right now: the form is replaced by the
  // closed notice, the countdown and the CTAs switch to the closed state, and
  // api/register.js answers 410 to every submission. Reopening needs BOTH this
  // flag true AND REGISTRATION_OPEN=true in the Vercel env vars.
  registrationOpen: false,

  // Shown in the form's place while registrationOpen is false.
  registrationClosedNote:
    "Online registration is now closed. Please join us at TRM Mall on walk day to ask about late slots, or call customer care on +254 142 631 157.",

  // Registration deadline (Africa/Nairobi time). Still the page's automatic
  // cut-off if the site is ever reopened: Wednesday 23 Sept 2026, 9:00 PM EAT.
  registrationDeadlineISO: "2026-09-23T21:00:00+03:00",
  registrationDeadlineLabel: "Wednesday 23 Sept · 9:00 PM EAT",

  formSubject: "New registration: Xana World Pharmacists Day Walk",
};
