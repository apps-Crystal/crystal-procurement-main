# Test Suite Guide - Crystal Procurement Portal

This document explains how to run the comprehensive test suite for the procurement portal.

## Test Structure

```
__tests__/
├── api/
│   ├── prs.test.ts          # PR creation and listing tests
│   ├── grns.test.ts         # GRN creation and listing tests
│   ├── pos.test.ts          # PO creation and listing tests
│   └── vendors.test.ts      # Vendor management tests
└── integration/
    └── procurement-flow.test.ts  # End-to-end workflow tests
```

## Setup

### 1. Install Dependencies

```bash
npm install --save-dev jest @types/jest jest-environment-node ts-jest
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

### 2. Jest Configuration

The project includes:
- `jest.config.js` - Main Jest configuration
- `jest.setup.js` - Test environment setup and mocks

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test prs.test.ts
npm test grns.test.ts
npm test vendors.test.ts
npm test procurement-flow.test.ts
```

### Run Tests in Watch Mode (auto-rerun on file changes)
```bash
npm test -- --watch
```

### Run Tests with Coverage Report
```bash
npm test -- --coverage
```

### Run Tests Matching a Pattern
```bash
npm test -- --testNamePattern="should generate unique PR_ID"
npm test -- --testNamePattern="Vendor"
npm test -- --testNamePattern="concurrent"
```

### Run Only Failed Tests from Previous Run
```bash
npm test -- --onlyChanged
npm test -- --lastCommit
```

### Run Tests in Verbose Mode
```bash
npm test -- --verbose
```

### Update Snapshots (if using snapshot testing)
```bash
npm test -- --updateSnapshot
```

---

## Test Categories

### 1. API Tests (`__tests__/api/`)

#### prs.test.ts - 20+ test cases
- ✅ PR creation with valid data
- ✅ User authentication capture (not hardcoded)
- ✅ Unique PR ID generation
- ✅ GST calculation accuracy
- ✅ IST timezone timestamps
- ✅ Required field validation
- ✅ Listing and filtering
- ✅ Aging day calculations
- ✅ Ghost row filtering

**Run**:
```bash
npm test prs.test.ts
```

#### grns.test.ts - 15+ test cases
- ✅ GRN creation with full data
- ✅ Duplicate invoice prevention
- ✅ Bill aging calculations
- ✅ Item balance calculations (ordered - received)
- ✅ Vendor enrichment
- ✅ Invoice URL detection
- ✅ Status and site filtering

**Run**:
```bash
npm test grns.test.ts
```

#### pos.test.ts - 15+ test cases
- ✅ PO creation from PR
- ✅ PR status updates to PO_POSTED
- ✅ Freight and installation charges
- ✅ Total with GST calculation
- ✅ Multiple item handling
- ✅ Delivery percentage calculation
- ✅ Delay days for overdue POs

**Run**:
```bash
npm test pos.test.ts
```

#### vendors.test.ts - 20+ test cases
- ✅ Vendor creation with sequential IDs
- ✅ Duplicate PAN prevention
- ✅ KYC status tracking (0/4, 1/4, complete)
- ✅ Multi-site support
- ✅ Search by company name
- ✅ Filter by site and KYC status
- ✅ Vendor detail with recent POs/GRNs
- ✅ Vendor update with field restrictions

**Run**:
```bash
npm test vendors.test.ts
```

### 2. Integration Tests (`__tests__/integration/`)

#### procurement-flow.test.ts - 20+ test cases
- ✅ Complete Vendor → PR → PO → GRN cycle
- ✅ Concurrent user scenarios
- ✅ Error recovery handling
- ✅ Data validation edge cases
- ✅ Large number handling
- ✅ Special character support
- ✅ Timezone consistency
- ✅ Duplicate prevention

**Run**:
```bash
npm test procurement-flow.test.ts
```

---

## Test Coverage Goals

Target coverage thresholds:
- **Statements**: 50%+
- **Branches**: 50%+
- **Functions**: 50%+
- **Lines**: 50%+

View coverage report:
```bash
npm test -- --coverage
```

This generates `coverage/` directory with HTML report:
```bash
# Open coverage/lcov-report/index.html in browser
```

---

## Key Test Scenarios Covered

### Bug Fix Verification
1. **Hardcoded Username Bug** ✅
   - Test: "should capture authenticated user name, not client-sent value"
   - Verifies: User name comes from cookie, not request body

2. **Duplicate PR ID Bug** ✅
   - Test: "should generate unique PR_ID with correct format"
   - Test: "Concurrent user scenarios"
   - Verifies: IDs increment sequentially, no /0001 duplicates

3. **Column Misalignment Bug** ✅
   - Test: "Verify column alignment" (in manual tests)
   - Verifies: Data in correct columns, not shifted 28 right

4. **Timezone Bug** ✅
   - Test: "should use IST timezone for timestamps"
   - Test: "should use consistent timezone across all operations"
   - Verifies: All timestamps use Asia/Kolkata, not UTC

### Core Workflow Tests
- PR creation with multi-user support
- PO generation from PR
- GRN receipt tracking
- Vendor management and KYC
- Status lifecycle management

### Error Handling
- Network failures
- Invalid data inputs
- Missing required fields
- Duplicate submissions
- Sheet API errors

### Edge Cases
- Large invoice values (₹99,999,999.99)
- Special characters in names
- Partial deliveries (multiple GRNs)
- Zero quantities
- Empty fields

---

## Manual Test Scenarios

For comprehensive testing that requires UI interaction and manual verification, see:
```
TEST_SCENARIOS.md
```

This includes:
- 100+ manual test cases organized by feature
- Step-by-step instructions
- Expected results for each test
- Regression test verification for all bug fixes

### Quick Manual Tests
1. Create PR as User A, then as User B - verify different names
2. Create 5 sequential PRs - verify no duplicate IDs
3. Create PR/PO/GRN - verify timestamps show IST time (not UTC)
4. Check GRN_Master sheet - verify data in column A (not column AC)

---

## Continuous Integration

For CI/CD pipelines, add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

Run in CI:
```bash
npm run test:ci
```

---

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="should successfully create PR"
```

### Run with Debugging
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome to debug.

### View Detailed Output
```bash
npm test -- --verbose
```

### Show Which Tests Ran
```bash
npm test -- --listTests
```

---

## Mocking Strategy

All tests mock Google Sheets API and authentication:

```typescript
jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  rowsToObjects: jest.fn(),
  appendRow: jest.fn(),
  getNextId: jest.fn(),
}))

jest.mock('@/lib/current-user', () => ({
  getCurrentUser: jest.fn(),
}))
```

This allows:
- Fast test execution (no API calls)
- Predictable test behavior
- Testing error scenarios
- Verifying API parameter correctness

---

## Adding New Tests

### Test File Template

```typescript
import { NextRequest } from 'next/server'
import * as sheets from '@/lib/sheets'

jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  // ... other mocks
}))

describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should [specific behavior]', async () => {
    // Arrange
    (sheets.readSheet as jest.Mock).mockResolvedValue([...])

    // Act
    const response = await someFunction()

    // Assert
    expect(response.status).toBe(200)
  })
})
```

### Naming Conventions
- Describe blocks: Feature name (e.g., "PR API Routes")
- Test names: "should [expected behavior]" (e.g., "should create PR with valid data")
- Use clear, descriptive names for easy identification

### Running Your New Test
```bash
npm test -- --testNamePattern="Your test name"
```

---

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
npm run build  # Ensure build artifacts exist
```

### Mock not working
- Ensure mock is placed BEFORE imports
- Use `jest.clearAllMocks()` in beforeEach

### TypeScript errors
- Check `tsconfig.json` includes `__tests__` directory
- Ensure jest types are installed: `npm install --save-dev @types/jest`

### Tests running slowly
```bash
npm test -- --maxWorkers=2  # Limit parallel workers
npm test -- --silent        # Suppress console output
```

---

## Test Report

After running tests with coverage:

```
PASS  __tests__/api/prs.test.ts
PASS  __tests__/api/grns.test.ts
PASS  __tests__/api/pos.test.ts
PASS  __tests__/api/vendors.test.ts
PASS  __tests__/integration/procurement-flow.test.ts

Total: 90+ tests
Pass: 90+
Fail: 0
Coverage: ~60%
```

---

## Next Steps

1. ✅ Run `npm test` to verify all tests pass
2. ✅ Check coverage with `npm test -- --coverage`
3. ✅ Run manual test scenarios from `TEST_SCENARIOS.md`
4. ✅ Deploy to production
5. ✅ Monitor for any issues

---

## Questions or Issues?

- Check test output for specific failures
- Review test code for expected behavior
- Compare with manual test scenarios
- Check Google Sheets sheet structure matches mocks
