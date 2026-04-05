# Voice Restaurant Practical Checklist

Use this checklist to track readiness from prototype to client handoff.

## Phase 1: MVP Ready (Functionality Stable)

- [ ] Voice ordering works by item name
- [x] Voice ordering works by item number (single and double digits)
- [x] Voice ordering supports quantity by number (for example, "add two number 15")
- [x] Voice ordering supports quantity by item name (for example, "add three dumplings")
- [x] Voice ordering supports multiple items in one command
- [x] Voice assistant welcome/intro is available on the order page
- [x] Voice assistant asks "Anything else?" after successful add-to-cart commands
- [x] Saying "no" after the follow-up opens the cart and gives checkout guidance
- [ ] Common speech variants work (to/too/two, for/four)
- [ ] Cart add/increase/decrease/remove works
- [ ] Checkout writes orders and clears cart
- [ ] Admin can create and delete food items
- [ ] Admin can view orders
- [ ] Clear error messages show for voice unsupported, storage full, and invalid image uploads

## Phase 2: Client Ready (Non-Technical User Friendly)

- [ ] Image upload uses resize/compression
- [ ] Image size limits are enforced
- [ ] Cart data does not store base64 images
- [ ] Hosted image URLs are used instead of local base64
- [ ] Menu and orders can be exported (JSON or CSV)
- [ ] Admin actions have simple success/error feedback
- [ ] Delete actions require confirmation
- [ ] Admin login/session timeout is tested

## Phase 3: Pre-Handoff QA

- [ ] Test on desktop Chrome
- [ ] Test on mobile Safari/Chrome
- [ ] Test on one lower-end device
- [ ] Run voice test script with at least 20 sample commands
- [ ] Include noisy-environment command tests
- [ ] Add 30+ menu items and place 20+ orders without storage crashes
- [ ] Verify refresh/reopen behavior keeps data consistent

### Voice Test Script (Compact Pass/Fail)

Mark one result per row:

| # | Voice command | Expected result | Pass | Fail |
| --- | --- | --- | --- | --- |
| 1 | add dumplings | Adds 1 dumplings item | [ ] | [ ] |
| 2 | add number 15 | Adds menu item 15 | [ ] | [ ] |
| 3 | add item 16 | Adds menu item 16 | [ ] | [ ] |
| 4 | add two number 15 | Adds 2 of menu item 15 | [ ] | [ ] |
| 5 | add 2 number 15 1 number 16 | Adds 2 of item 15 and 1 of item 16 | [ ] | [ ] |
| 6 | add three dumplings | Adds 3 dumplings | [ ] | [ ] |
| 7 | add two chicken fried rice | Adds 2 chicken fried rice | [ ] | [ ] |
| 8 | add two chicken fried rice three spring rolls and one dumpling | Adds all three items with correct quantities | [ ] | [ ] |
| 9 | add one beef dumpling and one pork dumpling | Adds beef dumpling + pork dumpling (not beef with ginger and spring onion) | [ ] | [ ] |
| 10 | show cart | Opens cart modal | [ ] | [ ] |
| 11 | show card | Opens cart modal (mishear handling) | [ ] | [ ] |
| 12 | show court | Opens cart modal (mishear handling) | [ ] | [ ] |
| 13 | add one dumpling then say no after Anything else | Opens cart and speaks checkout guidance | [ ] | [ ] |
| 14 | add to number 15 | Adds 2 of menu item 15 (to/too/two normalization) | [ ] | [ ] |
| 15 | add for dumplings | Adds 4 dumplings (for/four normalization) | [ ] | [ ] |

Pass target: at least 14/15 commands pass (>= 90%).

Score this run: Passed __ / 15, Failed __ / 15.

## Phase 4: Launch Ready (Operational)

- [ ] Admin credentials and setup are documented
- [ ] Image host account is configured and restricted
- [ ] Backup/export routine is defined
- [ ] Client quick-start guide is prepared
- [ ] Client troubleshooting guide is prepared
- [ ] Support contact and response expectations are documented

## Phase 5: Scale Ready (After Initial Usage)

- [ ] Move menu/orders from localStorage to a backend database
- [ ] Add admin action audit log
- [ ] Add order status flow (new/preparing/completed)
- [ ] Add analytics for top items and voice-command failure rate

## Go-Live Acceptance

Mark launch-ready when:

- [ ] All Phase 1 items are complete
- [ ] All Phase 2 items are complete
- [ ] At least 90% pass rate on voice test script
- [ ] No unresolved blockers in Phase 3
