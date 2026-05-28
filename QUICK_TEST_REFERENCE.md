# Quick Test Reference

## Install & Run

```bash
# Install test dependencies
npm install --save-dev jest @types/jest jest-environment-node ts-jest

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test prs.test.ts

# Watch mode (re-run on file changes)
npm test -- --watch
```

---

## Test Files Summary

| File | Tests | Purpose |
|------|-------|---------|
| `prs.test.ts` | 20+ | PR creation, listing, filtering, user capture, ID generation |
| `grns.test.ts` | 15+ | GRN creation, duplicate prevention, aging, item balance |
| `pos.test.ts` | 15+ | PO from PR, freight/install charges, delivery tracking |
| `vendors.test.ts` | 20+ | Vendor CRUD, KYC tracking, search, filtering, updates |
| `procurement-flow.test.ts` | 20+ | End-to-end workflows, concurrent users, error recovery |

**Total**: 90+ test cases covering all major features

---

## Key Tests for Bug Fixes

✅ **Username Bug** (was showing "Yatish Agarwal" for all users)
```bash
npm test -- --testNamePattern="capture authenticated user name"
```

✅ **Duplicate PR IDs** (was generating PR-Mumbai-May2026/0001 repeatedly)
```bash
npm test -- --testNamePattern="generate unique PR_ID"
```

✅ **Column Misalignment** (data shifted 28 columns right to column AC)
```bash
npm test -- --testNamePattern="column"
```

✅ **Timezone Issue** (showing UTC instead of IST)
```bash
npm test -- --testNamePattern="IST timezone"
```

---

## Manual Testing

For UI and integration testing:
```bash
# Read comprehensive manual test scenarios
cat TEST_SCENARIOS.md
```

Covers:
- 100+ manual test steps
- Each feature thoroughly tested
- Edge cases and error scenarios
- All bug fixes verified

---

## Before Deployment

1. Run all tests:
   ```bash
   npm test -- --coverage
   ```

2. Verify coverage (target: 50%+):
   ```bash
   npm test -- --coverage
   # Check coverage/ directory
   ```

3. Run manual smoke tests from TEST_SCENARIOS.md:
   - Create vendor as User A
   - Create PR as User B
   - Verify different names captured
   - Check PR ID increments correctly
   - Verify timestamps show IST time

4. Check Google Sheets:
   - PR_Master has no ghost rows with blank PR_ID
   - Counters sheet shows correct LastSerial values
   - Data is in correct columns (not shifted)

5. Deploy when all tests pass ✅

---

## Common Commands

```bash
# Run all tests
npm test

# Run tests matching pattern
npm test -- --testNamePattern="vendor"

# Run specific file
npm test vendors.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Verbose output
npm test -- --verbose

# Update snapshots (if using)
npm test -- --updateSnapshot

# Run only failed tests
npm test -- --onlyChanged
```

---

## What's Tested

✅ **Functionality**
- PR creation and listing
- PO generation from PR
- GRN receipt tracking
- Vendor management

✅ **Data Integrity**
- Unique ID generation
- Correct calculations (GST, totals)
- User capture (not hardcoded)
- Duplicate prevention

✅ **Timestamps**
- IST timezone (not UTC)
- Correct month in IDs
- Aging calculations

✅ **Filters & Search**
- By site, status, KYC
- Search by name/GST/PAN
- Multiple filter combinations

✅ **Error Handling**
- Required field validation
- Sheet API failures
- Invalid input handling

✅ **Edge Cases**
- Large numbers
- Special characters
- Partial deliveries
- Concurrent operations

---

## Expected Results

```
PASS  __tests__/api/prs.test.ts
  PR API Routes
    POST /api/prs - Create PR
      ✓ should successfully create PR with valid data
      ✓ should capture authenticated user name, not client-sent value
      ✓ should generate unique PR_ID with correct format
      ... (15+ more tests)
    GET /api/prs - List PRs
      ✓ should return all PRs
      ✓ should filter by site
      ... (5+ more tests)

PASS  __tests__/api/grns.test.ts
  GRN API Routes
    ... (15+ tests)

PASS  __tests__/api/pos.test.ts
  PO API Routes
    ... (15+ tests)

PASS  __tests__/api/vendors.test.ts
  Vendor API Routes
    ... (20+ tests)

PASS  __tests__/integration/procurement-flow.test.ts
  Procurement Portal - Integration Tests
    ... (20+ tests)

Total: 90+
Passed: 90+
Failed: 0
Coverage: ~60%
```

---

## Documentation

- **TESTING_GUIDE.md** - Detailed testing guide with all commands
- **TEST_SCENARIOS.md** - 100+ manual test scenarios with steps
- This file - Quick reference

Choose based on your need:
- Quick check → This file
- Run specific test → TESTING_GUIDE.md
- Manual/UI testing → TEST_SCENARIOS.md

---

## Next Steps

1. Install dependencies: `npm install --save-dev jest @types/jest jest-environment-node ts-jest`
2. Run tests: `npm test`
3. Check coverage: `npm test -- --coverage`
4. Run manual tests from TEST_SCENARIOS.md
5. Deploy when ready ✅
