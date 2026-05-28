# Procurement Portal - Manual Test Scenarios

## Overview
This document provides comprehensive manual test scenarios for the Crystal Procurement Portal. These tests should be performed to ensure all features work correctly, especially after deployments or major changes.

---

## 1. Vendor Management Tests

### 1.1 Create New Vendor
**Objective**: Verify vendor creation with all fields populated correctly

**Test Steps**:
1. Navigate to Vendors → Add New Vendor
2. Fill in all fields:
   - Company Name: "Test Vendor Corp"
   - Contact Person: "John Doe"
   - Phone: "9876543210"
   - Email: "vendor@test.com"
   - GST: "27AABCT1234F"
   - PAN: "AABCT1234F"
   - Bank: "HDFC"
   - Account: "123456789"
   - Branch: "Mumbai"
   - IFSC: "HDFC0000001"
   - Address: "Mumbai, India"
   - Sites: "Mumbai"
3. Click Submit

**Expected Results**:
- ✅ Vendor ID generated in format V-XXXX
- ✅ Entry appears in Vendor list immediately
- ✅ User name appears in "Created By" field (not hardcoded)
- ✅ Current timestamp appears with correct IST timezone

---

### 1.2 Prevent Duplicate PAN Registration
**Objective**: Verify system prevents registering same PAN twice

**Test Steps**:
1. Create Vendor 1 with PAN "AABCT1111F"
2. Try creating Vendor 2 with same PAN
3. Click Submit

**Expected Results**:
- ✅ Error message: "PAN already registered under [Vendor 1 Name]"
- ✅ Form does not submit
- ✅ Vendor 2 is not created

---

### 1.3 Update Vendor Details
**Objective**: Verify vendor information can be updated

**Test Steps**:
1. Go to Vendors, click on existing vendor
2. Update Contact Person to "New Contact"
3. Update Phone number
4. Upload bank documents if needed
5. Click Save

**Expected Results**:
- ✅ Changes are saved immediately
- ✅ Updated timestamp appears with IST timezone
- ✅ Changes persist on page reload

---

### 1.4 KYC Status Tracking
**Objective**: Verify KYC completion percentage updates correctly

**Test Steps**:
1. Create new vendor (KYC should show "0/4 docs")
2. Upload GST Certificate
3. Upload PAN Card
4. Upload Cancelled Cheque
5. Upload MSME Certificate

**Expected Results**:
- ✅ KYC shows "1/4 docs" after first upload
- ✅ KYC shows "2/4 docs" after second upload
- ✅ KYC shows "3/4 docs" after third upload
- ✅ KYC shows "Complete" when all 4 uploaded

---

## 2. Purchase Requisition (PR) Tests

### 2.1 Create PR with Multiple Users
**Objective**: Verify each user's name is captured correctly

**Test Steps**:
1. User A logs in
2. Create PR with items
3. Submit
4. User A logs out
5. User B logs in
6. Create PR with items
7. Submit
8. Check PR_Master sheet

**Expected Results**:
- ✅ PR 1 shows "Requested_By: User A Name" (not hardcoded name)
- ✅ PR 2 shows "Requested_By: User B Name"
- ✅ Different users have different PR_IDs with incrementing counters

---

### 2.2 PR ID Generation and Sequencing
**Objective**: Verify PR IDs generate correctly and don't duplicate

**Test Steps**:
1. Create 5 PRs for Mumbai site
2. Record all PR IDs
3. Check sheet for counter values

**Expected Results**:
- ✅ PR IDs follow format: PR-Mumbai-[Month][Year]/[Counter]
- ✅ Examples: PR-Mumbai-May2026/001, PR-Mumbai-May2026/002, etc.
- ✅ No duplicate /0001 suffixes
- ✅ Counter increments sequentially

---

### 2.3 Total Value Calculation with GST
**Objective**: Verify PR total is calculated correctly including GST

**Test Steps**:
1. Create PR with these items:
   - Item 1: Qty 10, Rate 100, GST 18%
   - Item 2: Qty 5, Rate 200, GST 5%
2. Calculate expected: (10 × 100 × 1.18) + (5 × 200 × 1.05) = 1180 + 1050 = 2230
3. Check PR in sheet for "Total_Incl_GST"

**Expected Results**:
- ✅ Total shows 2230.00
- ✅ GST is applied per item correctly

---

### 2.4 PR Status Lifecycle
**Objective**: Verify PR moves through status correctly

**Test Steps**:
1. Create PR (status should be "PR_SUBMITTED")
2. Approve PR (status should change to "PR_APPROVED")
3. Create PO from PR (status should change to "PO_POSTED")

**Expected Results**:
- ✅ Status reflects current step in lifecycle
- ✅ Status changes are saved immediately
- ✅ "Last_Action_By" shows current user

---

### 2.5 Required Fields Validation
**Objective**: Verify form requires all mandatory fields

**Test Steps**:
1. Try creating PR without Site
2. Try creating PR without Category
3. Try creating PR without items
4. Try submitting empty items list

**Expected Results**:
- ✅ Cannot create PR without Site (error: "Site is required")
- ✅ Cannot create PR without Category (error: "Category is required")
- ✅ Cannot create PR without items (error: "At least one line item is required")

---

## 3. Purchase Order (PO) Tests

### 3.1 Create PO from PR
**Objective**: Verify PO is created from PR and PR status updates

**Test Steps**:
1. Create and approve PR (PR-001)
2. Click "Create PO" on PR
3. Fill PO details:
   - Date: Today
   - Expected Delivery: +10 days
   - Payment Terms: "Net 30"
4. Click Submit

**Expected Results**:
- ✅ PO is created with format PO-[Site]-[Month]/[Counter]
- ✅ PO includes all items from PR
- ✅ PR status changes to "PO_POSTED"
- ✅ PR_Master sheet shows "Last_Action_By: [Current User]"

---

### 3.2 Handle Freight and Installation Charges
**Objective**: Verify freight and installation charges are captured

**Test Steps**:
1. Create PO with:
   - Items total: 50,000
   - Freight: 5,000
   - Installation: 10,000
2. Check sheet values

**Expected Results**:
- ✅ Has_Freight = "Yes", Freight_Amount = 5000
- ✅ Has_Installation = "Yes", Installation_Amount = 10000
- ✅ Total should include base amount + freight + installation

---

### 3.3 Multiple PO Items Handling
**Objective**: Verify all items from PR are transferred to PO correctly

**Test Steps**:
1. Create PR with 10 line items
2. Create PO from PR
3. Check PO_Items sheet

**Expected Results**:
- ✅ All 10 items appear in PO_Items
- ✅ Quantities match PR quantities
- ✅ Rates and GST match PR values

---

### 3.4 Delivery Delay Calculation
**Objective**: Verify delay days are calculated when no GRNs received

**Test Steps**:
1. Create PO with Expected_Delivery_Date = 5 days ago
2. View PO in list (no GRNs should be received yet)
3. Check "delay_days" field

**Expected Results**:
- ✅ delay_days shows 5+ (exact value depends on current date)
- ✅ Delay calculation only applies when no GRNs exist for PO

---

## 4. Goods Receipt Note (GRN) Tests

### 4.1 Create GRN After PO
**Objective**: Verify GRN captures goods receipt data

**Test Steps**:
1. Create approved PO (PO-001) with:
   - Item 1: 100 units ordered
   - Item 2: 50 units ordered
2. Create GRN for same PO:
   - Item 1: 100 units received (full delivery)
   - Item 2: 45 units received (short delivery)
3. Submit

**Expected Results**:
- ✅ GRN ID generated: GRN-[Site]-[Month]/[Counter]
- ✅ Invoice information captured
- ✅ Item balance calculated: Item1 = 0, Item2 = 5

---

### 4.2 Prevent Duplicate Invoice
**Objective**: Verify system prevents same invoice being recorded twice

**Test Steps**:
1. Create GRN for PO-001:
   - Vendor: V-0001
   - Invoice: "INV-2026-001"
2. Try creating another GRN for same vendor:
   - Vendor: V-0001
   - Invoice: "INV-2026-001"

**Expected Results**:
- ✅ First GRN created successfully
- ✅ Second GRN submission fails with error: "Duplicate invoice. Already recorded in [GRN_ID]"

---

### 4.3 Bill Aging Days Calculation
**Objective**: Verify aging is calculated for invoices without payment

**Test Steps**:
1. Create GRN dated 10 days ago with Invoice_URL filled
2. View GRN in list
3. Create another GRN dated 10 days ago with NO Invoice_URL
4. View GRN list

**Expected Results**:
- ✅ First GRN: has_invoice=true, bill_aging_days=0 (has invoice, no aging)
- ✅ Second GRN: has_invoice=false, bill_aging_days=10 (no invoice, aging counted)

---

### 4.4 Partial Delivery Handling
**Objective**: Verify system handles partial deliveries correctly

**Test Steps**:
1. Create PO with Item A: 100 units
2. Create GRN 1: 60 units received
3. Create GRN 2: 30 units received
4. Create GRN 3: 10 units received (total = 100)

**Expected Results**:
- ✅ All 3 GRNs created successfully
- ✅ Balance quantities calculated correctly for each
- ✅ System allows multiple GRNs for same PO

---

### 4.5 Vendor Information Enrichment
**Objective**: Verify vendor name appears in GRN listing

**Test Steps**:
1. Create GRN with Vendor_ID = V-0001 (Acme Corp)
2. View GRN list
3. Check vendor_name field

**Expected Results**:
- ✅ GRN shows vendor_name = "Acme Corp"
- ✅ Vendor name fetched from Vendor_Master sheet

---

## 5. Timestamp and Timezone Tests

### 5.1 Verify IST Timezone Usage
**Objective**: Ensure all timestamps use IST (Asia/Kolkata), not UTC

**Test Steps**:
1. Create PR at exactly 12:30 PM IST
2. Check PR_Master sheet for Timestamp field
3. Check counter sheet UpdatedAt field
4. Repeat for PO and GRN

**Expected Results**:
- ✅ PR Timestamp shows 12:30 (IST), NOT 07:00 (UTC)
- ✅ Counter UpdatedAt shows current IST time
- ✅ All dates follow IST timezone

---

### 5.2 Month Calculation in IST
**Objective**: Verify month in IDs calculated in IST timezone

**Test Steps**:
1. Create PR/PO/GRN on last day of month (before midnight IST)
2. Check ID format includes current month
3. Create another after midnight IST (next month)
4. Check ID includes new month

**Expected Results**:
- ✅ PR created 11:59 PM on May 31st shows "May2026" in ID
- ✅ PR created 12:01 AM on June 1st shows "June2026" in ID
- ✅ Month calculation respects IST, not UTC

---

## 6. Filter and Search Tests

### 6.1 PR Filter by Site
**Objective**: Verify site filtering works for PRs

**Test Steps**:
1. Create PRs for Mumbai, Bangalore, Delhi
2. Click filter "Site: Mumbai"
3. Verify only Mumbai PRs show

**Expected Results**:
- ✅ Only Mumbai PRs displayed
- ✅ Bangalore and Delhi PRs hidden
- ✅ Count at top updates

---

### 6.2 PR Filter by Status
**Objective**: Verify status filtering works for PRs

**Test Steps**:
1. Create 5 PRs, set 2 to "Approved", 3 to "Submitted"
2. Click filter "Status: PR_APPROVED"
3. Verify only 2 approved PRs show

**Expected Results**:
- ✅ Only approved PRs shown
- ✅ Submitted PRs hidden
- ✅ Multiple status filters can be combined with site filter

---

### 6.3 Vendor Search by Name
**Objective**: Verify search finds vendors by company name

**Test Steps**:
1. Create vendors: "Acme Corp", "Beta Supplies", "Acme Services"
2. Search for "Acme"
3. Verify results

**Expected Results**:
- ✅ Returns both Acme vendors
- ✅ Beta Supplies not shown
- ✅ Search is case-insensitive

---

### 6.4 Vendor Filter by KYC Status
**Objective**: Verify KYC filter works

**Test Steps**:
1. Create Vendor 1 (0/4 docs) and Vendor 2 (4/4 docs)
2. Click filter "KYC: Complete"
3. Verify only Vendor 2 shown

**Expected Results**:
- ✅ Only complete KYC vendors shown
- ✅ Incomplete KYC vendors hidden

---

## 7. Error Handling and Edge Cases

### 7.1 Handling Network Failures
**Objective**: Verify app handles Google Sheets API failures

**Test Steps**:
1. Disable internet connection (simulate)
2. Try creating PR
3. Check error message

**Expected Results**:
- ✅ Shows user-friendly error message
- ✅ No crash or hang
- ✅ Can retry after connection restored

---

### 7.2 Large Numbers Handling
**Objective**: Verify system handles large invoice values

**Test Steps**:
1. Create GRN with invoice_value = 999,999,999.99
2. Create PR with 1000+ line items
3. Check calculations

**Expected Results**:
- ✅ Large values stored correctly
- ✅ Calculations don't overflow
- ✅ Display shows values correctly formatted

---

### 7.3 Special Characters in Names
**Objective**: Verify special characters in vendor/item names don't break system

**Test Steps**:
1. Create Vendor: "O'Reilly & Associates (Pvt) Ltd."
2. Create PR Item: "High-Speed USB 3.0 Cable – Type-C"
3. Submit and verify

**Expected Results**:
- ✅ Special characters preserved correctly
- ✅ Data displays properly in sheets
- ✅ No encoding issues

---

## 8. Data Integrity Tests

### 8.1 Verify No Ghost Rows
**Objective**: Ensure incomplete submissions don't leave blank rows

**Test Steps**:
1. Attempt to create PR but cancel midway
2. Navigate to PR sheet
3. Search for rows with blank PR_ID

**Expected Results**:
- ✅ No dashed/ghost rows with blank PR_IDs
- ✅ PR_Master list excludes ghost rows

---

### 8.2 Verify Column Alignment
**Objective**: Ensure data is in correct columns (not shifted)

**Test Steps**:
1. Create PR with all fields
2. Open PR_Master sheet
3. Verify:
   - PR_ID in column A
   - PR_Timestamp in correct column
   - Data NOT shifted 28 columns to right

**Expected Results**:
- ✅ PR_ID at column A
- ✅ All fields in correct columns
- ✅ No column shift issues

---

## 9. Concurrent Operations Tests

### 9.1 Simultaneous PR Creation
**Objective**: Verify multiple concurrent PR creations don't conflict

**Test Steps**:
1. Open 3 browser tabs
2. Tab 1: Create PR for Mumbai
3. Tab 2: Create PR for Bangalore (while Tab 1 still submitting)
4. Tab 3: Create PR for Delhi
5. Check counters

**Expected Results**:
- ✅ All 3 PRs created successfully
- ✅ Each gets unique ID with correct counter
- ✅ No duplicate counter values
- ✅ No race condition errors

---

## 10. UI/UX Tests

### 10.1 Form Submission and Response
**Objective**: Verify UI updates correctly after submission

**Test Steps**:
1. Fill PR form
2. Click Submit
3. Observe UI

**Expected Results**:
- ✅ Loading indicator appears
- ✅ Button disabled during submission
- ✅ Success message shows with PR ID
- ✅ Form clears for next entry
- ✅ PR appears in list immediately

---

### 10.2 Error Message Display
**Objective**: Verify error messages are clear and helpful

**Test Steps**:
1. Try creating PR without required fields
2. Observe error messages

**Expected Results**:
- ✅ Error appears in red banner
- ✅ Message clearly states what's missing
- ✅ Form doesn't submit

---

### 10.3 Responsive Design
**Objective**: Verify forms work on mobile and tablet

**Test Steps**:
1. Open on mobile device (or emulate)
2. Create PR
3. Check layout and usability

**Expected Results**:
- ✅ Form is readable and usable
- ✅ Buttons are clickable
- ✅ No horizontal scroll needed
- ✅ Fields stack appropriately

---

## 11. Regression Tests (Post-Bug-Fixes)

### 11.1 Username Fix Verification
**Objective**: Confirm fix for hardcoded "Yatish Agarwal" issue

**Test Steps**:
1. Log in as User A
2. Create PR
3. Log out, Log in as User B
4. Create PR
5. Check sheet for "Requested_By" values

**Expected Results**:
- ✅ PR 1 shows User A's actual name (not Yatish Agarwal)
- ✅ PR 2 shows User B's actual name

---

### 11.2 Duplicate PR ID Fix Verification
**Objective**: Confirm fix for duplicate /0001 ID issue

**Test Steps**:
1. Create 5 PRs consecutively
2. Record all PR IDs
3. Verify no duplicates

**Expected Results**:
- ✅ PR IDs: .../001, .../002, .../003, .../004, .../005
- ✅ No duplicate /0001 entries

---

### 11.3 Column Alignment Fix Verification
**Objective**: Confirm data is in correct columns (28-column shift fixed)

**Test Steps**:
1. Create PR
2. Open PR_Master sheet
3. Verify PR_ID is in Column A (not Column AC)

**Expected Results**:
- ✅ Data starts at column A
- ✅ No 28-column offset
- ✅ All fields aligned correctly

---

### 11.4 Timezone Fix Verification
**Objective**: Confirm timestamps use IST, not UTC

**Test Steps**:
1. Create PR/PO/GRN
2. Record current local time
3. Check sheet timestamp

**Expected Results**:
- ✅ Timestamp matches local IST time
- ✅ NOT 5.5 hours behind (UTC)
- ✅ Month calculation uses IST

---

## Test Execution Checklist

- [ ] All Vendor Management tests passed
- [ ] All PR tests passed
- [ ] All PO tests passed
- [ ] All GRN tests passed
- [ ] All Timestamp tests passed
- [ ] All Filter/Search tests passed
- [ ] All Error Handling tests passed
- [ ] All Data Integrity tests passed
- [ ] All Concurrent Operations tests passed
- [ ] All UI/UX tests passed
- [ ] All Regression tests passed

**Date Tested**: ___________
**Tester Name**: ___________
**Issues Found**: ___________
**Status**: ☐ All Pass ☐ Needs Fixes

---

## Notes for Future Testers

1. Always test with at least 2 different user accounts
2. Check both UI and actual sheet data
3. Test with realistic quantities (not just 1 item)
4. Pay special attention to timestamp formatting
5. Verify month calculations near month boundaries
6. Check counter increment is sequential
7. Look for any dashed/ghost rows in sheets
