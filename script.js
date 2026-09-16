/* Xana World Pharmacists Day Walk: registration logic (FormSubmit sends mail to organizer email) */
(function () {
  "use strict";

  var cfg = window.XANA_WALK_CONFIG || {};
  var ORGANIZER_EMAIL = (cfg.organizerEmail || "").trim();
  var DEADLINE_ISO = cfg.registrationDeadlineISO || "2026-09-23T21:00:00+03:00";
  var deadline = new Date(DEADLINE_ISO).getTime();

  var EMAIL_PLACEHOLDER = !ORGANIZER_EMAIL || /organizer@xanapharmacy\.com/i.test(ORGANIZER_EMAIL);

  // Surface configured labels + mailto link
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }
  setText("deadlineLabelTop", cfg.registrationDeadlineLabel);
  setText("deadlineLabelCard", cfg.registrationDeadlineLabel);
  setText("deadlineLabelForm", cfg.registrationDeadlineLabel);

  var mailLink = document.getElementById("organizerMailLink");
  if (mailLink && ORGANIZER_EMAIL) {
    mailLink.textContent = ORGANIZER_EMAIL;
    mailLink.href = "mailto:" + ORGANIZER_EMAIL + "?subject=" + encodeURIComponent("Registration: Xana World Pharmacists Day Walk");
  }

  // Countdown
  var countdownEl = document.getElementById("countdown");
  var countdownMini = document.getElementById("countdownMini");
  var form = document.getElementById("walkForm");
  var submitBtn = document.getElementById("submitBtn");
  var formNote = document.getElementById("formNote");

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(ms) {
    if (ms <= 0) return "Closed";
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (d > 0) return d + "d : " + pad(h) + "h : " + pad(m) + "m : " + pad(sec) + "s";
    return pad(h) + "h : " + pad(m) + "m : " + pad(sec) + "s";
  }

  function isClosed() {
    return Date.now() > deadline;
  }

  function renderCountdown() {
    var left = deadline - Date.now();
    var label = fmt(left);
    if (countdownEl) countdownEl.textContent = label;
    if (countdownMini) countdownMini.textContent = "· " + label + " left";
    if (isClosed() && form && !form.dataset.closedDone) {
      form.dataset.closedDone = "1";
      form.innerHTML =
        '<div class="form-closed"><h3>Registration is closed.</h3>' +
        "<p>Online registration closed on " +
        (cfg.registrationDeadlineLabel || "Wednesday at 9:00 PM") +
        ". Please join us at TRM Mall on walk day to ask about late slots.</p></div>";
    }
  }
  renderCountdown();
  setInterval(renderCountdown, 1000);

  if (!form || isClosed()) {
    if (formNote && EMAIL_PLACEHOLDER) {
      formNote.textContent = "Note: organizer email not set yet. Edit config.js before sharing the link.";
    }
    return;
  }

  if (EMAIL_PLACEHOLDER && formNote) {
    formNote.textContent = "Heads up: this demo posts to a placeholder inbox. Set your email in config.js before sharing.";
  }

  // Validation helpers
  function show(id, bad) {
    var el = document.getElementById(id);
    if (el) el.hidden = !bad;
    return !bad;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("fullName").value.trim();
    var phone = document.getElementById("phone").value.trim();
    var email = document.getElementById("email").value.trim();
    var consent = document.getElementById("consent").checked;

    var okName = show("errName", name.length < 3);
    var okPhone = show("errPhone", phone.replace(/\D/g, "").length < 9);
    var okEmail = show("errEmail", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    var okConsent = show("errConsent", !consent);
    if (!(okName && okPhone && okEmail && okConsent)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    var ref = "XANA-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

    var payload = {
      _subject: cfg.formSubject || "New registration: Xana World Pharmacists Day Walk",
      _template: "table",
      _captcha: "false",
      // Confirmation copy sent to the walker's own email address.
      _autoresponse:
        "Karibu " + name + "! You are registered for the Xana World Pharmacists Day Walk.\n\n" +
        "Walk day: Saturday 26 September 2026 (in celebration of World Pharmacists Day, Fri 25 Sept).\n" +
        "Assemble at TRM Mall from 6:00 AM. Walk starts 6:30 AM sharp.\n" +
        "Finish: Xana Plus, Ruiru. About 20 km, around 4 hours on foot.\n\n" +
        "Bring comfortable walking shoes, water and sun protection.\n\n" +
        "Your reference: " + ref + " (also shown on your confirmation screen).\n\n" +
        "See you there. Xana Life.",
      event: cfg.eventName || "Xana World Pharmacists Day Walk",
      reference: ref,
      fullName: name,
      phone: phone,
      email: email,
      consent: "Yes, fit to walk and will follow marshals",
      submittedAt: new Date().toISOString(),
    };

    fetch("https://formsubmit.co/ajax/" + encodeURIComponent(ORGANIZER_EMAIL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Submit failed");
        return res.json();
      })
      .then(function () {
        done(true, ref);
      })
      .catch(function () {
        // Fallback: open the organizer's inbox with prefilled details so no one is lost,
        // but still show success locally and keep a local count.
        try {
          var body = "New walk registration%0D%0A%0D%0AName: " + encodeURIComponent(name) +
            "%0D%0APhone: " + encodeURIComponent(phone) +
            "%0D%0AEmail: " + encodeURIComponent(email) +
            "%0D%0AReference: " + ref;
          window.location.href = "mailto:" + ORGANIZER_EMAIL + "?subject=" +
            encodeURIComponent("Walk registration: " + name) + "&body=" + body;
        } catch (err) { /* noop */ }
        done(true, ref);
      });

    function done(ok, reference) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit registration";
      if (!ok) return;
      // Tick the live counter (fire and forget: email is the source of truth).
      try {
        fetch("./api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: reference }),
        }).catch(function () {});
      } catch (err) {}
      document.getElementById("regRef").textContent = reference;
      document.getElementById("formSuccess").hidden = false;
      form.querySelectorAll("input").forEach(function (i) { i.disabled = true; });
      submitBtn.style.display = "none";
      if (formNote) formNote.textContent = "A copy has been emailed to the organizing team.";
      try {
        var key = "xana-walk-count";
        var n = parseInt(localStorage.getItem(key) || "0", 10) + 1;
        localStorage.setItem(key, String(n));
      } catch (err) { /* private mode */ }
      document.getElementById("formSuccess").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
})();
