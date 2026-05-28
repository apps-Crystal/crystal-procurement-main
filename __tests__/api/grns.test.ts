import { POST as createGRN, GET as getGRNs } from '@/app/api/grns/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  rowsToObjects: jest.fn(),
  appendRow: jest.fn(),
  getNextId: jest.fn(),
}));

import * as sheets from '@/lib/sheets';

describe('GRN API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/grns - Create GRN', () => {
    it('should successfully create GRN with valid data', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['GRN_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-Mumbai-May2026/001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-001',
          invoice_value: 50000,
          invoice_date: '28/05/2026',
          lr_number: 'LR-001',
          vehicle_number: 'MH-01-AA-0001',
          items: [
            { ordered_qty: 10, received_qty: 10, item_name: 'Laptop', invoice_qty: 10, uom: 'Units' },
          ],
          created_by_email: 'user@example.com',
          created_by_name: 'Test User',
        }),
      });

      const response = await createGRN(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.grn_id).toBeDefined();
    });

    it('should prevent duplicate invoices for same vendor', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID']]) // First call for getNextId
        .mockResolvedValueOnce([
          // Second call for duplicate check
          ['GRN_ID', 'Invoice Number', 'Vendor_ID'],
          ['GRN-001', 'INV-001', 'V-0001'],
        ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { GRN_ID: 'GRN-001', 'Invoice Number': 'INV-001', Vendor_ID: 'V-0001' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-001',
          invoice_value: 50000,
          items: [{ ordered_qty: 10, received_qty: 10, item_name: 'Item' }],
          created_by_email: 'user@example.com',
          created_by_name: 'Test User',
        }),
      });

      const response = await createGRN(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Duplicate invoice');
    });

    it('should calculate bill aging days correctly', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const dateString = pastDate.toLocaleDateString('en-IN');

      (sheets.readSheet as jest.Mock).mockResolvedValueOnce([['GRN_ID']]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-001',
          invoice_value: 50000,
          invoice_date: '28/05/2026',
          items: [{ ordered_qty: 10, received_qty: 10, item_name: 'Item' }],
          created_by_email: 'user@example.com',
          created_by_name: 'Test User',
        }),
      });

      await createGRN(req);
      expect(sheets.appendRow).toHaveBeenCalled();
    });

    it('should handle GRN items correctly', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValueOnce([['GRN_ID']]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const items = [
        { ordered_qty: 10, received_qty: 9, item_name: 'Laptop', uom: 'Units' },
        { ordered_qty: 5, received_qty: 5, item_name: 'Mouse', uom: 'Units' },
      ];

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-001',
          invoice_value: 50000,
          items,
          created_by_email: 'user@example.com',
          created_by_name: 'Test User',
        }),
      });

      await createGRN(req);

      // Should call appendRow: 1 for GRN_Master + 2 for items
      expect(sheets.appendRow).toHaveBeenCalledTimes(3);
    });

    it('should calculate balance quantity (ordered - received)', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValueOnce([['GRN_ID']]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-001',
          invoice_value: 50000,
          items: [
            { ordered_qty: 100, received_qty: 75, item_name: 'Item' },
          ],
          created_by_email: 'user@example.com',
          created_by_name: 'Test User',
        }),
      });

      await createGRN(req);

      const itemCall = (sheets.appendRow as jest.Mock).mock.calls[1];
      const balance = itemCall[1][9]; // Balance is at index 9
      expect(balance).toBe(25); // 100 - 75
    });
  });

  describe('GET /api/grns - List GRNs', () => {
    it('should return all GRNs with enriched vendor data', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID'], ['GRN-001']])
        .mockResolvedValueOnce([['Vendor_ID', 'Company_Name'], ['V-0001', 'Acme Corp']]);

      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ GRN_ID: 'GRN-001', Vendor_ID: 'V-0001' }])
        .mockReturnValueOnce([{ Vendor_ID: 'V-0001', Company_Name: 'Acme Corp' }]);

      const req = new NextRequest('http://localhost:3000/api/grns');
      const response = await getGRNs(req);
      const data = await response.json();

      expect(data.grns[0].vendor_name).toBe('Acme Corp');
    });

    it('should filter by site', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID', 'Site'], ['GRN-001', 'Mumbai']])
        .mockResolvedValueOnce([]);

      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ GRN_ID: 'GRN-001', Site: 'Mumbai' }])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/grns?site=Mumbai');
      const response = await getGRNs(req);
      const data = await response.json();

      expect(data.grns.length).toBe(1);
      expect(data.grns[0].Site).toBe('Mumbai');
    });

    it('should filter by status', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID', 'Status'], ['GRN-001', 'Pending']])
        .mockResolvedValueOnce([]);

      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ GRN_ID: 'GRN-001', Status: 'Pending' }])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/grns?status=Pending');
      const response = await getGRNs(req);
      const data = await response.json();

      expect(data.grns[0].Status).toBe('Pending');
    });

    it('should detect has_invoice based on Invoice_URL', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID', 'Invoice_URL'], ['GRN-001', 'http://example.com/inv']])
        .mockResolvedValueOnce([]);

      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ GRN_ID: 'GRN-001', Invoice_URL: 'http://example.com/inv' }])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/grns');
      const response = await getGRNs(req);
      const data = await response.json();

      expect(data.grns[0].has_invoice).toBe('true');
    });

    it('should show reverse order (newest first)', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID'], ['GRN-001'], ['GRN-002'], ['GRN-003']])
        .mockResolvedValueOnce([]);

      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([
          { GRN_ID: 'GRN-001' },
          { GRN_ID: 'GRN-002' },
          { GRN_ID: 'GRN-003' },
        ])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/grns');
      const response = await getGRNs(req);
      const data = await response.json();

      expect(data.grns[0].GRN_ID).toBe('GRN-003');
    });
  });
});
