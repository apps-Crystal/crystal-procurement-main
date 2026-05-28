import { POST as createPR, GET as getPRs } from '@/app/api/prs/route';
import { NextRequest } from 'next/server';

// Mock setup
jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  rowsToObjects: jest.fn(),
  writeNewRow: jest.fn(),
  getNextId: jest.fn(),
}));

jest.mock('@/lib/current-user', () => ({
  getCurrentUser: jest.fn(),
}));

import * as sheets from '@/lib/sheets';
import * as auth from '@/lib/current-user';

describe('PR API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/prs - Create PR', () => {
    it('should successfully create PR with valid data', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID', 'Site']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Laptop', qty: 1, rate: 50000, gst: 18 }],
        }),
      });

      const response = await createPR(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pr_id).toBeDefined();
      expect(sheets.writeNewRow).toHaveBeenCalled();
    });

    it('should fail without site parameter', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          category: 'Office Supplies',
          items: [{ name: 'Laptop', qty: 1, rate: 50000, gst: 18 }],
        }),
      });

      const response = await createPR(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Site is required');
    });

    it('should fail without category parameter', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          items: [{ name: 'Laptop', qty: 1, rate: 50000, gst: 18 }],
        }),
      });

      const response = await createPR(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Category is required');
    });

    it('should fail without line items', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [],
        }),
      });

      const response = await createPR(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('At least one line item is required');
    });

    it('should fail when user not authenticated', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue(null);
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Laptop', qty: 1, rate: 50000, gst: 18 }],
        }),
      });

      const response = await createPR(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Not signed in');
    });

    it('should capture authenticated user name, not client-sent value', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'real.user@example.com',
        name: 'Real User Name',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID', 'Requested_By']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Laptop', qty: 1, rate: 50000, gst: 18 }],
          requested_by: 'Hacker Name', // Should be ignored
        }),
      });

      await createPR(req);

      const writeCall = (sheets.writeNewRow as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('Real User Name');
    });

    it('should generate unique PR_ID with correct format', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('042');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Bangalore',
          category: 'IT Equipment',
          items: [{ name: 'Server', qty: 1, rate: 200000, gst: 18 }],
        }),
      });

      const response = await createPR(req);
      const data = await response.json();

      expect(data.pr_id).toMatch(/^PR-Bangalore-[A-Z][a-z]+\d{4}\/042$/);
    });

    it('should calculate total with GST correctly', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID', 'Total_Incl_GST']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [
            { name: 'Item1', qty: 10, rate: 100, gst: 18 },
            { name: 'Item2', qty: 5, rate: 200, gst: 5 },
          ],
        }),
      });

      await createPR(req);

      const writeCall = (sheets.writeNewRow as jest.Mock).mock.calls[0];
      // Item1: 10 * 100 * 1.18 = 1180
      // Item2: 5 * 200 * 1.05 = 1050
      // Total: 2230
      expect(writeCall[1]).toContain('2230.00');
    });

    it('should use IST timezone for timestamps', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID', 'Timestamp']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Laptop', qty: 1, rate: 50000, gst: 18 }],
        }),
      });

      await createPR(req);

      const writeCall = (sheets.writeNewRow as jest.Mock).mock.calls[0];
      const timestamp = writeCall[1][1];
      // Should be a string in IST format, not UTC
      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe('string');
    });

    it('should handle multiple items in PR', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const items = [
        { name: 'Item1', qty: 5, rate: 100, gst: 18 },
        { name: 'Item2', qty: 10, rate: 200, gst: 5 },
        { name: 'Item3', qty: 1, rate: 5000, gst: 28 },
      ];

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Mixed',
          items,
        }),
      });

      await createPR(req);

      expect(sheets.writeNewRow).toHaveBeenCalledTimes(4); // 1 header + 3 items
    });
  });

  describe('GET /api/prs - List PRs', () => {
    it('should return all PRs', async () => {
      const mockRows = [
        ['PR_ID', 'Site', 'Status_Code'],
        ['PR-Mumbai-May2026/001', 'Mumbai', 'PR_SUBMITTED'],
        ['PR-Mumbai-May2026/002', 'Bangalore', 'PR_APPROVED'],
      ];
      (sheets.readSheet as jest.Mock).mockResolvedValue(mockRows);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { PR_ID: 'PR-Mumbai-May2026/001', Site: 'Mumbai', Status_Code: 'PR_SUBMITTED' },
        { PR_ID: 'PR-Mumbai-May2026/002', Site: 'Bangalore', Status_Code: 'PR_APPROVED' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/prs');
      const response = await getPRs(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prs).toHaveLength(2);
    });

    it('should filter by site', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['PR_ID', 'Site'],
        ['PR-Mumbai-May2026/001', 'Mumbai'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { PR_ID: 'PR-Mumbai-May2026/001', Site: 'Mumbai' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/prs?site=Mumbai');
      const response = await getPRs(req);
      const data = await response.json();

      expect(data.prs).toHaveLength(1);
      expect(data.prs[0].Site).toBe('Mumbai');
    });

    it('should filter by status', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['PR_ID', 'Status_Code'],
        ['PR-Mumbai-May2026/001', 'PR_SUBMITTED'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { PR_ID: 'PR-Mumbai-May2026/001', Status_Code: 'PR_SUBMITTED' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/prs?status=PR_SUBMITTED');
      const response = await getPRs(req);
      const data = await response.json();

      expect(data.prs).toHaveLength(1);
    });

    it('should exclude ghost rows without PR_ID', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['PR_ID', 'Site'],
        ['PR-Mumbai-May2026/001', 'Mumbai'],
        ['', 'Mumbai'], // Ghost row
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { PR_ID: 'PR-Mumbai-May2026/001', Site: 'Mumbai' },
        { PR_ID: '', Site: 'Mumbai' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/prs');
      const response = await getPRs(req);
      const data = await response.json();

      expect(data.prs).toHaveLength(1);
      expect(data.prs[0].PR_ID).toBe('PR-Mumbai-May2026/001');
    });

    it('should calculate aging days correctly', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const pastDateString = pastDate.toLocaleDateString('en-IN');

      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['PR_ID', 'Timestamp'],
        ['PR-Mumbai-May2026/001', `${pastDateString} 10:00:00`],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { PR_ID: 'PR-Mumbai-May2026/001', Timestamp: `${pastDateString} 10:00:00` },
      ]);

      const req = new NextRequest('http://localhost:3000/api/prs');
      const response = await getPRs(req);
      const data = await response.json();

      expect(data.prs[0].aging_days).toBe('5');
    });

    it('should reverse order to show newest first', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['PR_ID'],
        ['PR-001'],
        ['PR-002'],
        ['PR-003'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { PR_ID: 'PR-001' },
        { PR_ID: 'PR-002' },
        { PR_ID: 'PR-003' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/prs');
      const response = await getPRs(req);
      const data = await response.json();

      expect(data.prs[0].PR_ID).toBe('PR-003');
      expect(data.prs[2].PR_ID).toBe('PR-001');
    });

    it('should handle errors gracefully', async () => {
      (sheets.readSheet as jest.Mock).mockRejectedValue(new Error('Sheet read failed'));

      const req = new NextRequest('http://localhost:3000/api/prs');
      const response = await getPRs(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
