# Community board requirements and regression review

## Verdict on the supplied screenshot

The original Find a traveller form was not correct for the request flow. It reused trip-owner wording and options, assumed a flight, required extra notes, and forced parcel/travel-company choices even when the user simply wanted to know who was travelling. The corrected form separates the two intents without changing the sheet's column structure.

## Requirement mapping

| Original community need | Implemented behaviour | Regression coverage |
| --- | --- | --- |
| Ask who is coming from Lucknow to Hyderabad | Request, route `lko`, default purpose Find a traveller, Any mode | Frontend form/payload tests, Python validation, Apps Script route/options matrix |
| Ask who is coming from Hyderabad to Lucknow | Same request with route `hyd` | Both route matrices, contact message test, filter test |
| Ask when someone is coming | Request has a required Needed by deadline, explicitly explained as travel on or before that day | Form switching, deadline card label, date boundary validation |
| Volunteer an itinerary | Share your trip, confirmed Travel date, transport, optional itinerary notes | Trip defaults, flow switching, all valid options, persistence |
| Share an itinerary without promising to carry anything | Default Just sharing my trip | Frontend defaults and backend validation |
| Keep one shared board in a Google Sheet | Google-hosted app and localhost use the same list/create operations | HTTP routing, simulated sheet reads/writes, no SQLite fallback on remote errors |

## Correct field meaning

| Field | Find a traveller | Share your trip |
| --- | --- | --- |
| Name | Requester's name, required | Traveller's name, required |
| WhatsApp | Requester's contact, required | Traveller's contact, required |
| Direction | Direction in which a traveller is needed | Traveller's actual direction |
| Date | Needed by; deadline, required | Actual travel date, required |
| Transport | Preferred transport, default Any mode | Travelling by: Flight, Train, Car, Not decided |
| Help/purpose | What do you need? Find a traveller, A small parcel, Travel company, Other | Happy to help with: Just sharing my trip, A small parcel, Travel company, Anything I can |
| Notes | Optional request context | Optional flight/train number, departure time, itinerary context |

Required dates must be today or later. Both servers use India time for expiry. Contact numbers accept 10–15 digits with formatting; 10-digit Indian numbers are normalized to +91. Formatting is removed before WhatsApp links are built. Arbitrary letters, oversized numbers and missing contacts are rejected.

## Additional fixes

- Switching between request/trip dialogs resets labels, options, defaults, placeholders, deadline hint, and submit wording.
- A request card says By before its date, rather than presenting a deadline as a confirmed itinerary.
- Extra notes are optional throughout HTML, Python, and Apps Script.
- Repeated submit events during a pending save cannot send a second write.
- A read started before a successful save cannot overwrite and hide the new post.
- Failed writes leave the form and fields intact and never appear as successful posts or fall back to browser storage.
- Saved counts exclude unavailable posts.
- WhatsApp messages now include the direction and distinguish a trip date from a request deadline.
- Select field styling has consistent height and a visible dropdown arrow; native option menus remain browser-controlled.
- Formula-like sheet text is escaped and card text is HTML-escaped.

## Automated verification

Run from the repository root:

```sh
python3 build.py
python3 -m unittest discover -s test -p 'test_*.py'
```

The Python tests cover validation, both route/flow option matrices, boundaries, actual temporary SQLite persistence, proxy payloads, HTTP responses, errors, and generated source consistency.

On macOS, `test_javascript.py` executes the real frontend and Apps Script source using the system JavaScriptCore runtime. It uses simulated DOM, HTTP and spreadsheet services. The JavaScript harnesses cover form switching, request payloads, route/date/search/tab filters, newest sorting, saves, contact links, empty states, double submissions, stale reads, failed saves, sheet edits, active/completed/cancelled status, past dates, text escaping, serializable dates, column changes, lock release and HTTP read/write entry points. These tests are skipped outside macOS; they do not replace a real browser or Google authorization test.

## Remaining manual checks

Live Google and browser checks are not verified in this environment (network access and a browser preview are unavailable). No automated test writes to your real sheet.

1. Replace both Apps Script `Code.gs` and `Index.html` with the current generated files. Save and deploy a new version of the existing deployment.
2. Restart the Python server and refresh localhost.
3. Open Find a traveller: confirm request-specific wording, Any mode, Find a traveller, deadline hint, optional notes. Submit one request in each direction with a future deadline.
4. Check rows in Posts, then open the Google-hosted app and confirm those same requests appear.
5. Share a trip with Just sharing my trip and no notes. Confirm its card and sheet row show a trip rather than a request.
6. Edit a note/date in the sheet and verify it refreshes. Set status to completed, then cancelled; confirm the post is hidden.
7. Check Connect opens the correct WhatsApp recipient, direction and date.
8. Check desktop and phone layouts, native selects, keyboard tab order, focus indicators, Escape-to-close and touch scrolling in the dialog.
9. Disable the connection while saving: confirm an error, retained form values, no success card. After any timeout, inspect the sheet before retrying; a remote write may already have completed.

## Boundaries that remain

The request currently needs a deadline; fully open-ended dates, date ranges, and automatic traveller/request matching are not implemented. Itinerary details beyond date/mode are free text. Self-service edit/delete and member authentication are not implemented; sheet administrators can edit or hide rows. Duplicate network retries after an ambiguous timeout are not idempotent, although rapid duplicate clicks are blocked. These are separate features, not verified capabilities.


## 2026-11-24: Cloudflare migration follow-up

The user selected Cloudflare Workers + D1 and bought aawanjaawan.fun at Hostinger. The current backend implementation is `cloudflare/worker.mjs`; migration and account/domain setup are documented in `cloudflare/README.md`. Earlier Google instructions above apply only to the retained legacy integration.

Latest verification: 26 test cases passed, including 45 frontend assertions, 101 legacy Apps Script assertions, and 112 Worker handler/storage-contract assertions. The D1 schema and active/expired/status query were also exercised against real temporary SQLite. Worker tests under JavaScriptCore use simulated Web APIs/D1. `test/worker.test.mjs` is supplied for native Node Web API checks, but Node, Wrangler, live D1, browser QA and custom-domain smoke tests have not run in this restricted environment.

All HTTP(S) visits now use shared API storage, so a deployed domain cannot silently fall back to browser-local demo posts. The Cloudflare build packages only the app HTML/CSS/JS. Health checks require both the D1 binding and migrated Posts table. Worker validation preserves the distinct request/trip flows and optional notes. DNS and deployment are still pending account authorization; aawanjaawan.fun has not been verified live.
