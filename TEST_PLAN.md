# Crystal Procurement Portal — Manual Test Plan

Cases derived from the actual code in this repo: forms, validations, field names, statuses, dashboard tiles, and API behavior. Execute in Chrome on the deployed Vercel URL with DevTools (Network + Console) open.

- **App URL:** `https://crystal-procurement-main.vercel.app`
- **Backend tabs read/written:** `PR_Master`, `PR_Items`, `PO_Master`, `PO_Items`, `GRN_Master`, `GRN_Items`, `Vendor_Master`, `COUNTERS`
- **Tester:** ________________________   **Build commit:** ________________   **Date:** ____________

---

## 0. Pre-flight

| # | Check | Expected | Result |
|---|---|---|---|
| 0.1 | Visit `/` while not signed in | Crystal Core SSO challenge (or `?u=&n=&r=` redirect from middleware) | |
| 0.2 | Sign in as User A | Dashboard renders; sidebar bottom shows User A name, initials, role | |
| 0.3 | DevTools → Application → Cookies | `crystal_user` cookie present with JSON `{email, name, role}`; httpOnly | |
| 0.4 | Console on initial load | No red errors | |

---

## 1. Dashboard (`/`)

The dashboard tile counts come from `/api/dashboard`.

| # | Test | Steps | Expected |
|---|---|---|---|
| 1.1 | Pipeline tiles render | Open `/` | Five tiles: **PRs Awaiting Approval**, **Approved — No PO Yet**, **POs Active In Delivery**, **GRNs Pending Approval**, **GRNs Approved This Month**. Each is a clickable link |
| 1.2 | Click "PRs Awaiting Approval" | Click tile | Lands on `/prs?status=PR_SUBMITTED` showing only Submitted PRs |
| 1.3 | Click "Approved — No PO Yet" | Click tile | Lands on `/prs?status=PR_APPROVED` |
| 1.4 | Click "POs Active In Delivery" | Click tile | Lands on `/pos?status=PO_POSTED` |
| 1.5 | Site Breakdown table | Look at "Site Breakdown — This Month" | Rows for sites with any activity; Total row sums all columns |
| 1.6 | PO Value MTD formatting | Inspect PO Value column | Values format as `₹X.XCr`, `₹X.XL`, `₹XK`, or `₹X` |
| 1.7 | "Needs Attention" panel | Look at right column | Cards colored red (PR overdue), amber (delivery delayed / QC hold), indigo (invoice missing); empty state shows "All clear ✓" |
| 1.8 | Action click navigates | Click a `pr_overdue` action | Opens `/prs/{ID}` |
| 1.9 | Site filter affects dashboard | Sidebar site filter = "Kolkata" → reload | All tile counts and table reflect Kolkata only |
| 1.10 | Dashboard error state | (Optional) Force `/api/dashboard` to fail | Red "Could not load dashboard" panel shows error message |

---

## 2. Authentication & Identity

| # | Test | Steps | Expected |
|---|---|---|---|
| 2.1 | Sidebar shows current user | Bottom-left | Avatar with first+last name initials; below name shows `{role} · {siteLabel}` |
| 2.2 | Site filter dropdown | Click sidebar Site Filter | Options: All Sites, Noida, Detroj, Pune, Kheda, Kolkata, Ahmedabad, Bhubaneswar, Dhulagarh, Dankuni, Mumbai, Vavdi, Taloja |
| 2.3 | Filtering indicator | Pick "Kolkata" | Sidebar shows "Filtering: Kolkata" with ✕ clear button |
| 2.4 | Logout | Click Logout | Navigates to `/logout`; `crystal_user_email` cookie cleared |
| 2.5 | **Regression — `Requested_By` from cookie** | Sign in as User B → create a PR → check PR_Master | `Requested_By` column = User B's name (or email if name blank). Detail page shows "Raised by {User B name}" |
| 2.6 | **Regression — User A's PR ≠ User B's PR** | User A creates PR in one browser, User B creates PR in incognito | Each PR's `Requested_By` matches its creator (no cross-write) |
| 2.7 | Cookie missing → 401 | DevTools → delete `crystal_user` cookie → submit PR | Red banner "Not signed in" |

---

## 3. PR List (`/prs`)

| # | Test | Steps | Expected |
|---|---|---|---|
| 3.1 | Tabs render | Open `/prs` | Tabs: **All / Submitted / Approved / PO Posted / Rejected** |
| 3.2 | "+ New PR" button | Top right | Navigates to `/prs/new` |
| 3.3 | Table columns | Header row | PR ID, Date, Site, Purpose, Category, Amount, Status, Aging |
| 3.4 | Status badges | Look at status column | Submitted=blue, Approved=green, Rejected=red, PO Posted=purple |
| 3.5 | Aging colors | Inspect Aging col | <3d gray dash, 3–6d amber, ≥7d red bold |
| 3.6 | Search filters | Type "kolkata" or part of PR ID | Filters by PR_ID / PR_Purpose / Site / Vendor_ID (case-insensitive) |
| 3.7 | Site filter narrows list | Sidebar site = Noida | Only Noida PRs visible; footer shows "X of Y PRs" |
| 3.8 | Click row → detail | Click any row | Navigates to `/prs/{PR_ID}` |
| 3.9 | Newest at top | Compare first row's date | First row Timestamp is the most recent |
| 3.10 | **Regression — ghost rows hidden** | Look at "All" tab | No rows with empty PR ID (filtered out by `p.PR_ID && p.PR_ID.trim()`) |

---

## 4. New PR (`/prs/new`)

Fields the form sends to `/api/prs`: `site`, `category`, `procurement_type`, `vendor_id`, `purpose`, `payment_stages` (Advance / Before Delivery / Running / Post Delivery / Post Completion), `delivery_terms`, `delivery_location`, `expected_delivery`, `is_reimbursable`, `requisitioned_by`, `warranty_amc`, `items[]`.

### 4A. Form structure

| # | Test | Steps | Expected |
|---|---|---|---|
| 4A.1 | Sites dropdown | Open Site selector | Options: Noida, Detroj, Pune, Kheda, Kolkata, Ahmedabad, Bhubaneswar, Dhulagarh, Dankuni, Mumbai, Vavdi, Taloja |
| 4A.2 | Categories dropdown | Open Category selector | Civil, Electrical, Mechanical, IT & Telecom, Housekeeping, Security, Canteen, AMC / Service, Furniture, Stationery, Other |
| 4A.3 | Procurement Type dropdown | Open Procurement Type | Goods, Services, Works |
| 4A.4 | Reimbursable | Open dropdown | No, Yes |
| 4A.5 | Vendor search | Type 2+ chars in vendor search | Dropdown lists up to 8 results showing Company_Name, Vendor_ID, GST_Number, KYC badge |
| 4A.6 | Vendor selection | Pick a vendor | Search box replaced with `{Company} ({Vendor_ID})`; ✕ Clear button shown |
| 4A.7 | Payment stages | Enter 30 in Advance, 70 in Post Delivery | Summary chip appears: `Advance: 30% | Post Delivery: 70%` |
| 4A.8 | GST dropdown per item | Open GST cell | Values 0, 5, 12, 18, 28 |
| 4A.9 | Line total live calc | Set qty=10, rate=100, GST=18 | Line Total cell shows `₹1,180` |
| 4A.10 | Add / remove item | Click "+ Add Item", then ✕ | Row added; ✕ only visible when >1 row |
| 4A.11 | Grand Total | Multiple items | Grand Total = sum of (qty × rate × (1 + gst/100)) for all rows |

### 4B. Submit — client-side validation

| # | Test | Steps | Expected |
|---|---|---|---|
| 4B.1 | No site | Submit with site empty | Red banner "Please select a site" |
| 4B.2 | No category | Site set, category empty | "Please select a category" |
| 4B.3 | No item name | All filled but item_name empty | "At least one item is required" |

### 4B'. Submit — server-side validation

| # | Test | Steps | Expected |
|---|---|---|---|
| 4B'.1 | Server missing site | DevTools Console: `fetch('/api/prs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"items":[{"name":"x"}]}'}).then(r=>r.json()).then(console.log)` | `{error: "Site is required"}` HTTP 400 |
| 4B'.2 | Server missing category | Same as above, supply only site | `{error: "Category is required"}` |
| 4B'.3 | Server empty items | Supply site+category only | `{error: "At least one line item is required"}` |
| 4B'.4 | Not signed in | Delete `crystal_user` cookie → submit | `{error: "Not signed in"}` HTTP 401 |

### 4C. Submit — successful flow

| # | Test | Steps | Expected |
|---|---|---|---|
| 4C.1 | Goods PR | Site=Kolkata, Cat=IT & Telecom, Type=Goods, 1 item @ ₹1000×5 GST 18 | Redirects to `/prs/{newPR_ID}`; PR detail loads |
| 4C.2 | New PR_ID format | Inspect URL | `PR-{Site}-{MonthYYYY}/{NNNN}` e.g. `PR-Kolkata-May2026/0009` |
| 4C.3 | Detail page header | After submit | Title = PR_ID; badge = "Submitted" (blue); subtitle `{Site} · {Category} · Raised by {User name}` |
| 4C.4 | Detail page PR Details panel | Look at PR Details grid | Shows non-empty fields: Site, Category, Procurement Type, Vendor, Payment Terms, Delivery Terms, Delivery Location, Expected Delivery, Reimbursable, Requisitioned By, Warranty / AMC, Total (incl. GST) |
| 4C.5 | Detail page Lifecycle | Right sidebar | Step 1 (PR Submitted) green check with `{date} · {User}`; steps 2/3/4 show gray pending |
| 4C.6 | Items table on detail | Bottom card | Items match input; Grand Total = Total_Incl_GST |
| 4C.7 | Vendor card visible if vendor picked | Right sidebar | Shows Company_Name, Contact_Person, Contact_Number, Email_ID, GST_Number, KYC badge |
| 4C.8 | No vendor → no vendor card | Submit without vendor | "Vendor" card absent from right sidebar |

### 4D. Network failure surfaces

| # | Test | Steps | Expected |
|---|---|---|---|
| 4D.1 | **Regression — Network error** | DevTools Network → Offline → Submit | Red banner: `Network error: Failed to fetch` (or similar). Button no longer stuck on "Submitting..." |
| 4D.2 | **Regression — Non-JSON response** | (Can't easily simulate — observe if it ever happens) | Banner: `Server returned {status} with non-JSON response` |
| 4D.3 | **Regression — Missing pr_id in response** | (Hypothetical) | Banner: `Server did not return a PR ID` |

---

## 5. PR Detail (`/prs/{id}`) — Approve / Reject

| # | Test | Steps | Expected |
|---|---|---|---|
| 5.1 | "Approve / Reject" only when Submitted | Open a Submitted PR | Green "Approve / Reject" button visible |
| 5.2 | Modal opens | Click button | Modal shows PR_ID, Remarks textarea, Cancel/Reject/Approve buttons |
| 5.3 | Approve with remarks | Type "Looks good" → Approve | Status badge → "Approved" (green); Lifecycle step 2 green with `{date} · {Approver}`; Approver Remarks panel shows "Looks good" |
| 5.4 | Reject with remarks | New Submitted PR → Reject | Status → "Rejected" (red); Lifecycle step 2 red; "Approve / Reject" hidden; "Create PO" hidden |
| 5.5 | Approve after approve | Reopen approved PR | No "Approve / Reject" button (already actioned) |
| 5.6 | "Create PO" only when Approved & no PO yet | Open approved PR with no PO | Indigo "Create PO →" button shown |
| 5.7 | "Create PO" hidden after PO exists | Open PR after creating its PO | "Create PO →" replaced by "View PO →" |
| 5.8 | Approver Remarks shown when present | Approved PR with remarks | Bottom of PR Details card shows remarks in gray panel |
| 5.9 | Aging "X days pending" | Submit a PR, wait, approve later | Header shows "X days pending" if aging≥3 and status=Submitted |
| 5.10 | Documents card | If PR has Upload Quotation / Final Agreed PI / Supporting Docs links | Card with clickable badges opens links in new tab |

---

## 6. PR ID Generation & Counter (CRITICAL Regression)

| # | Test | Steps | Expected |
|---|---|---|---|
| 6.1 | **Counter increments** | Create 3 PRs back-to-back for Site=Kolkata in current month | IDs are sequential e.g. `…/0009`, `…/0010`, `…/0011`. **No duplicates** |
| 6.2 | **Per-site independence** | Create 1 Kolkata PR, then 1 Noida PR, then another Kolkata PR | Kolkata counter +2, Noida counter +1; no interleaving |
| 6.3 | COUNTERS sheet entry | Open `COUNTERS` tab | Row exists with `Key = PR:{Site}:{MonthYYYY}`, `LastSerial` = highest counter used, `UpdatedAt` recent IST timestamp |
| 6.4 | Counter creates row if absent | First PR for a new site/month combo | New row appended to COUNTERS with `LastSerial = 1` |
| 6.5 | Month rollover | After 1 June IST → create PR | New PR_ID uses `June2026`; first June PR is `/0001` |
| 6.6 | Special site name "HO / Kolkata" | Try to create PR for this site | PR_ID = `PR-HO / Kolkata-May2026/000X` (slashes in ID); COUNTERS key = `PR:HO / Kolkata:May2026` |
| 6.7 | **No duplicate PR_IDs in PR_Master** | Sort PR_Master by PR_ID and scan for repeats | Each PR_ID unique going forward (pre-fix duplicates may still exist — clean per §13) |

---

## 7. PR_Master Column Alignment (CRITICAL Regression)

This is the AC-shift bug. The fix uses `writeNewRow` (anchored at A1, INSERT_ROWS).

| # | Test | Steps | Expected |
|---|---|---|---|
| 7.1 | **PR_ID in column A** | Create a PR → open PR_Master → find new row | Column A has PR_ID; **not** column AC, **not** blank |
| 7.2 | Timestamp in column B | Same row | IST timestamp populated |
| 7.3 | Site in correct column | Same row | `Site` column header matches the value |
| 7.4 | Requested_By in correct column | Same row | `Requested_By` column = current user's name |
| 7.5 | Procurement_Type column | Same row | `Goods`/`Services`/`Works`, not the PR_Purpose value |
| 7.6 | No "exceeds grid limits" error | Submit PR when PR_Items has many rows | No red banner about grid limits; row appended fine; grid auto-extends |
| 7.7 | PR_Items rows aligned | Same submission → open PR_Items | Each item row has PR_ID in col A, Line_No in col B, Item_Name in col C, etc. |

---

## 8. Timezone (Regression)

| # | Test | Steps | Expected |
|---|---|---|---|
| 8.1 | **PR timestamp in IST** | Submit PR at e.g. 14:32 IST → check PR_Master row | Timestamp ≈ `28/05/2026, 14:32:XX` (within seconds); NOT 5h30m earlier |
| 8.2 | Counter UpdatedAt in IST | Check COUNTERS for that key after submission | IST clock |
| 8.3 | PR approval timestamp IST | Approve a PR at known IST time | `Last_Action_At`, `PR_Approved_DateTime` in IST |
| 8.4 | PO timestamp IST | Create a PO | PO_Master `Timestamp` column in IST |
| 8.5 | GRN timestamp IST | Record a GRN | GRN_Master timestamp in IST |
| 8.6 | Vendor `Last_Updated` IST | Edit a vendor | IST timestamp |
| 8.7 | Month boundary IST not UTC | Create PR at 00:30 IST on the 1st of a month | PR_ID uses the new month (IST), not the prior month (UTC) |

---

## 9. PO List & New (`/pos`, `/pos/new`)

| # | Test | Steps | Expected |
|---|---|---|---|
| 9.1 | PO List status tabs | Open `/pos` | Tabs: **All / Active / Archived** |
| 9.2 | Search PO | Type partial PO_ID, Vendor name, Site, or PR_ID | Filters list |
| 9.3 | New PO requires PR | Visit `/pos/new` (no `?pr=` param) | Form loads but `prData` empty; submit blocked by "No PR linked" |
| 9.4 | New PO from PR | From approved PR click "Create PO →" | `/pos/new?pr={PR_ID}` loads with PR Summary banner, vendor/payment/delivery prefilled, items prefilled from PR_Items |
| 9.5 | PO Date required | Clear PO Date → submit | "PO date is required" banner |
| 9.6 | At least one item with qty | Set all qty to 0 | "At least one item with qty is required" |
| 9.7 | PO totals | Submit → open PO detail | Total = sum of (qty × rate × (1 + gst/100)) |
| 9.8 | Freight & Installation | Enter freight=500, installation=1000 | Stored on PO row; visible in PO detail |
| 9.9 | PO_ID format | After submit | `PO-{Site}-{MonthYYYY}/{NNNN}` |
| 9.10 | PR status → PO_POSTED | Open the source PR | Status badge "PO Posted" (purple); lifecycle step 3 green |

---

## 10. GRN List & New (`/grns`, `/grns/new`)

| # | Test | Steps | Expected |
|---|---|---|---|
| 10.1 | GRN status tabs | Open `/grns` | Tabs: **All / Draft / Open / Approved** |
| 10.2 | Search GRN | Type GRN_ID / vendor / invoice number | Filters list |
| 10.3 | Status badges | Inspect | Draft=yellow, Open=blue, Approved=green, Flagged=red |
| 10.4 | New GRN — pick PO | Visit `/grns/new` → type 2+ chars in PO search | Up to 8 PO matches by PO_ID / vendor name / Site |
| 10.5 | New GRN — prefilled by `?po=` | Visit `/grns/new?po={PO_ID}` | PO auto-loaded; items pre-populated with ordered_qty + suggested received_qty |
| 10.6 | Item condition dropdown | Open Condition cell | Good, Partial, Damaged |
| 10.7 | Validation: no PO | Submit without selecting PO | "Please select a PO" |
| 10.8 | Validation: invoice number | PO picked, no invoice number | "Invoice number is required" |
| 10.9 | Validation: invoice value | No invoice value | "Invoice value is required" |
| 10.10 | Validation: no received qty | Set all received_qty to 0 | "At least one item with received quantity is required" |
| 10.11 | **Duplicate invoice rejection** | Submit GRN, then submit another with same invoice_number + vendor | Banner: `Duplicate invoice. Already recorded in {GRN_ID}` (HTTP 400) |
| 10.12 | GRN_ID format | Successful submit | `GRN-{Site}-{MonthYYYY}/{NNNN}` |

---

## 11. Vendors (`/vendors`, `/vendors/new`)

| # | Test | Steps | Expected |
|---|---|---|---|
| 11.1 | Vendor list filters | Open `/vendors` | Filters: All / KYC Complete / KYC Incomplete |
| 11.2 | Vendor search | Type company name, GST, PAN, or vendor ID | Server-side filter via `/api/vendors?search=` |
| 11.3 | Site filter | Sidebar = "Kolkata" | List narrows to vendors whose Providing_Sites includes Kolkata |
| 11.4 | New Vendor required field | Submit without Company Name | "Company name is required" |
| 11.5 | New Vendor — PAN dedupe | Submit with PAN already in use | `PAN already registered under {Company} ({Vendor_ID})` |
| 11.6 | New Vendor — Vendor_ID format | Successful submit | `V-NNNN` (sequential, padded to 4 digits) |
| 11.7 | Sites Served toggle | Click multiple site chips | Toggle on/off (purple when selected); stored as comma-joined string |
| 11.8 | KYC computation | Vendor with all 4 of: `GST_Certificate_Link`, `PanCard_Link`, `Cancelled_Cheque_Link`, `MSME_Certificate_Link` | KYC badge = "Complete" green; otherwise "X/4 docs" amber, or red if 0/4 |
| 11.9 | Vendor detail / edit | Click a vendor row | Detail page loads at `/vendors/{Vendor_ID}` |

---

## 12. Site Filter Behavior

| # | Test | Steps | Expected |
|---|---|---|---|
| 12.1 | Filter persists across pages | Pick "Noida" → navigate `/`→`/prs`→`/pos`→`/grns`→`/vendors` | "Filtering: Noida" persists everywhere |
| 12.2 | "All Sites" | Clear filter | All sites visible in every list |
| 12.3 | Each list calls API with `site` param | DevTools Network → click each tab | API calls include `?site=Noida` (and `status=`) |

---

## 13. Sheet Hygiene & Cleanup (post-test, manual)

After running, the tester should clean these things in Google Sheets:

| # | Action | Why |
|---|---|---|
| 13.1 | In **PR_Master**, sort by PR_ID, delete rows where PR_ID is blank | Ghost rows from the pre-fix column-shift bug |
| 13.2 | In **PR_Items**, delete rows whose PR_ID doesn't exist in PR_Master | Orphan items |
| 13.3 | In **COUNTERS**, confirm the only columns are `Key | LastSerial | UpdatedAt` (3 cols). Delete any 4-column garbage (`PR | Site | Month | 1`) | Leftover from the broken `getNextId` |
| 13.4 | For each `PR:{Site}:{Month}` row in COUNTERS, set `LastSerial` to the highest counter actually used in PR_Master for that site/month | So the next PR doesn't re-issue an existing number |
| 13.5 | Same hygiene for PO_Master / PO_Items / GRN_Master / GRN_Items | Defense in depth |

---

## 14. Edge / Stress

| # | Scenario | Expected |
|---|---|---|
| 14.1 | Long purpose text (~5000 chars) | Submits OK; detail page renders without overflow break |
| 14.2 | Special chars in Purpose: `Quotes "Test" & <html> ₹100 — em-dash` | Stored verbatim; rendered as plain text (no HTML execution) |
| 14.3 | 5 rapid back-to-back PR submissions same site | All succeed with sequential `/NNNN`; no race-condition duplicate (note: true concurrent multi-user race may still collide — out of scope) |
| 14.4 | Browser back after PR submit | Returns to `/prs/new` empty form; no duplicate submission |
| 14.5 | Refresh on PR detail | Same data; no stale state |
| 14.6 | Submit PR with 100+ line items | All items written to PR_Items with correct line_no 1..100 |
| 14.7 | Cookie expired mid-session (>8h) | First write attempt → 401 "Not signed in"; user re-SSOs |

---

## Result Tally

| Section | Cases | Pass | Fail | Notes |
|---|---|---|---|---|
| 0. Pre-flight | 4 | | | |
| 1. Dashboard | 10 | | | |
| 2. Auth & Identity | 7 | | | |
| 3. PR List | 10 | | | |
| 4. New PR (A+B+B'+C+D) | 24 | | | |
| 5. PR Detail / Approve | 10 | | | |
| 6. PR ID & Counter | 7 | | | |
| 7. Column Alignment | 7 | | | |
| 8. Timezone | 7 | | | |
| 9. PO | 10 | | | |
| 10. GRN | 12 | | | |
| 11. Vendors | 9 | | | |
| 12. Site Filter | 3 | | | |
| 13. Sheet Hygiene | 5 | | | |
| 14. Edge / Stress | 7 | | | |
| **TOTAL** | **132** | | | |

---

## Sign-off

- Tester: ____________________   Date: __________
- Reviewer: __________________   Date: __________
- Defects logged: __________________________
