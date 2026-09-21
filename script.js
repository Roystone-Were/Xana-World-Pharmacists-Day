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
  var form = document.getElementById("walkForm");
  var submitBtn = document.getElementById("submitBtn");
  var formNote = document.getElementById("formNote");

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Countdown. Both instances (top deadline bar + hero card) share one tick
  // that walks down to the second. Each tick only rewrites the four numbers,
  // pulses the seconds group, and switches the urgency tier on <body>, which
  // is what styles.css animates: calm > warn (24h, amber) > urgent (6h, red).
  var CD_WARN_MS = 24 * 60 * 60 * 1000;
  var CD_URGENT_MS = 6 * 60 * 60 * 1000;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var cdRoots = Array.prototype.map.call(document.querySelectorAll("[data-cd]"), function (root) {
    return {
      root: root,
      days: root.querySelector("[data-cd-days]"),
      secs: root.querySelector(".cd-secs"),
      nums: ["d", "h", "m", "s"].map(function (unit) {
        return root.querySelector('[data-cd-num="' + unit + '"]');
      }),
      a11y: root.querySelector("[data-cd-a11y]"),
      pulse: null,
    };
  });
  var cdTier = "";

  // Only touch the DOM when a value actually changed: this runs every second.
  function cdText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  // Web Animations API rather than a CSS animation, so every tick restarts the
  // pulse in sync with the number it accompanies (a CSS timeline would drift).
  function cdPulse(r, urgent) {
    if (!r.secs || !r.secs.animate || reduceMotion.matches || document.hidden) return;
    if (r.pulse) r.pulse.cancel(); // one live pulse per root, never a pile-up
    r.pulse = r.secs.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: urgent ? 0.35 : 0.5, transform: "scale(1.07)", offset: 0.35 },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: urgent ? 900 : 600, easing: "ease-out" }
    );
  }

  function isClosed() {
    return Date.now() > deadline;
  }

  function renderCountdown() {
    var left = deadline - Date.now();
    var tier = left <= 0 ? "closed" : left <= CD_URGENT_MS ? "urgent" : left <= CD_WARN_MS ? "warn" : "calm";
    if (tier !== cdTier) {
      document.body.dataset.urgency = tier; // styles.css keys urgency off this
      cdTier = tier;
    }

    if (left > 0) {
      var s = Math.floor(left / 1000);
      var d = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      cdRoots.forEach(function (r) {
        r.days.classList.toggle("is-off", d === 0);
        cdText(r.nums[0], d);
        cdText(r.nums[1], pad(h));
        cdText(r.nums[2], pad(m));
        cdText(r.nums[3], pad(sec));
        // Screen readers get the coarse value once per hour, not a per-second feed.
        cdText(
          r.a11y,
          d > 0
            ? d + " day" + (d === 1 ? "" : "s") + " " + h + " hour" + (h === 1 ? "" : "s") + " left"
            : h > 0
              ? h + " hour" + (h === 1 ? "" : "s") + " " + m + " minutes left"
              : m + " minute" + (m === 1 ? "" : "s") + " left"
        );
        cdPulse(r, tier === "urgent");
      });
    }

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

  // Custom T-shirt dropdown (button + listbox, fully styleable unlike <select>).
  var ddBtn = document.getElementById("tshirtBtn");
  var ddList = document.getElementById("tshirtList");
  var ddLabel = document.getElementById("tshirtBtnLabel");
  var ddValue = document.getElementById("tshirt");
  var ddOptions = ddList ? Array.prototype.slice.call(ddList.querySelectorAll('[role="option"]')) : [];
  var ddActive = -1;

  function ddClose() {
    if (!ddList || ddList.hidden) return;
    ddList.hidden = true;
    ddBtn.setAttribute("aria-expanded", "false");
  }
  function ddOpen() {
    ddList.hidden = false;
    ddBtn.setAttribute("aria-expanded", "true");
  }
  function ddPick(opt) {
    ddOptions.forEach(function (o) { o.setAttribute("aria-selected", "false"); });
    opt.setAttribute("aria-selected", "true");
    ddValue.value = opt.getAttribute("data-value");
    ddLabel.textContent = opt.getAttribute("data-value");
    ddBtn.classList.add("has-value");
    ddClose();
    ddBtn.focus();
  }
  if (ddBtn && ddList) {
    ddBtn.addEventListener("click", function () {
      if (ddBtn.disabled) return;
      if (ddList.hidden) ddOpen(); else ddClose();
    });
    ddOptions.forEach(function (opt) {
      opt.addEventListener("click", function () { ddPick(opt); });
    });
    document.addEventListener("click", function (e) {
      if (!document.getElementById("tshirtDD").contains(e.target)) ddClose();
    });
    document.addEventListener("keydown", function (e) {
      if (ddList.hidden) return;
      if (e.key === "Escape") { ddClose(); ddBtn.focus(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        ddActive = e.key === "ArrowDown"
          ? Math.min(ddActive + 1, ddOptions.length - 1)
          : Math.max(ddActive - 1, 0);
        ddOptions.forEach(function (o) { o.classList.remove("dd-active"); });
        var cur = ddOptions[ddActive];
        if (cur) {
          cur.classList.add("dd-active");
          if (cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (e.key === "Enter" && ddActive >= 0 && ddOptions[ddActive]) {
        e.preventDefault();
        ddPick(ddOptions[ddActive]);
      }
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("fullName").value.trim();
    var phone = document.getElementById("phone").value.trim();
    var email = document.getElementById("email").value.trim();
    var tshirt = document.getElementById("tshirt").value;
    var consent = document.getElementById("consent").checked;

    var okName = show("errName", name.length < 3);
    var okPhone = show("errPhone", phone.replace(/\D/g, "").length < 9);
    var okEmail = show("errEmail", email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    var okTshirt = show("errTshirt", !tshirt);
    var okConsent = show("errConsent", !consent);
    if (!(okName && okPhone && okEmail && okTshirt && okConsent)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    var ref = "XANA-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

    // Primary path: our own backend sends fully-worded Mailgun mail
    // (organizer + walker), ticks the counter and triggers the SMS.
    fetch("./api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ reference: ref, name: name, phone: phone, email: email, tshirt: tshirt }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Register failed");
        return res.json();
      })
      .then(function (data) {
        if (data && data.mail && data.mail.organizer) {
          done(true, ref, data);
        } else {
          // Mailgun not configured: fall back to FormSubmit for the organizer mail.
          sendOrganizerMail(function () { done(true, ref, data); });
        }
      })
      .catch(function () {
        // Last resort: open the organizer inbox with prefilled details.
        try {
          var body = "New walk registration%0D%0A%0D%0AName: " + encodeURIComponent(name) +
            "%0D%0APhone: " + encodeURIComponent(phone) +
            "%0D%0AEmail: " + encodeURIComponent(email) +
            "%0D%0AReference: " + ref;
          window.location.href = "mailto:" + ORGANIZER_EMAIL + "?subject=" +
            encodeURIComponent("Walk registration: " + name) + "&body=" + body;
        } catch (err) { /* noop */ }
        done(true, ref, null);
      });

    function sendOrganizerMail(next) {
      var payload = {
        _subject: cfg.formSubject || "New registration: Xana World Pharmacists Day Walk",
        _template: "table",
        _captcha: "false",
        "Event": cfg.eventName || "Xana World Pharmacists Day Walk",
        "Reference": ref,
        "Full name": name,
        "Phone number": phone,
        "Email address": email || "Not provided",
        "T-shirt size": tshirt,
        "Fitness and safety consent": "Yes, fit to walk and will follow marshals",
        "Submitted at": new Date().toISOString(),
      };
      if (email) {
        payload._cc = email;
        payload._replyto = email;
      }
      fetch("https://formsubmit.co/ajax/" + encodeURIComponent(ORGANIZER_EMAIL), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Submit failed");
          return res.json();
        })
        .then(function () { next(); })
        .catch(function () { next(); });
    }

    function done(ok, reference, data) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit registration";
      if (!ok) return;
      document.getElementById("regRef").textContent = reference;
      var mailWalker = !!(data && data.mail && data.mail.walker);
      var smsSent = !!(data && data.sms);
      document.getElementById("successMsg").textContent =
        "Karibu! See you at TRM Mall on Saturday 26 Sept by 6:00 AM. " +
        "Your details were sent to the organizing team." +
        (mailWalker && email ? " A confirmation email was sent to " + email + "." : (email ? " A copy was also CC'd to " + email + "." : "")) +
        (smsSent && phone ? " A confirmation SMS was also sent to " + phone + "." : "");
      document.getElementById("formSuccess").hidden = false;
      form.querySelectorAll("input, #tshirtBtn").forEach(function (i) { i.disabled = true; });
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
