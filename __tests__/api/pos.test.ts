import { POST as createPO, GET as getPOs } from '@/app/api/pos/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  rowsToObjects: jest.fn(),
  appendRow: jest.fn(),
  getNextId: jest.fn(),
  findRowIndex: jest.fn(),
  updateRow: jest.fn(),
}));

import * as sheets from '@/lib/sheets';

describe('PO API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/pos - Create PO', () => {
    it('should successfully create PO with valid data', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(1);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-Mumbai-May2026/001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          vendor_name: 'Acme Corp',
          po_date: '28/05/2026',
          expected_delivery_date: '10/06/2026',
          items: [{ name: 'Laptop', qty: 5, rate: 50000, gst: 18, uom: 'Units' }],
          created_by: 'Test User',
        }),
      });

      const response = await createPO(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.po_id).toBeDefined();
    });

    it('should generate correct PO_ID format', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('042');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(1);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-001',
          site: 'Bangalore',
          vendor_id: 'V-0001',
          vendor_name: 'Vendor',
          items: [{ name: 'Item', qty: 1, rate: 100, gst: 18 }],
          created_by: 'User',
        }),
      });

      const response = await createPO(req);
      const data = await response.json();

      expect(data.po_id).toMatch(/^PO-Bangalore-[A-Z][a-z]+\d{4}\/042$/);
    });

    it('should calculate total including GST', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID', 'Total_Incl_GST']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(1);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          vendor_name: 'Vendor',
          items: [
            { name: 'Item1', qty: 10, rate: 100, gst: 18 },
            { name: 'Item2', qty: 5, rate: 200, gst: 5 },
          ],
          created_by: 'User',
        }),
      });

      await createPO(req);

      const poCall = (sheets.appendRow as jest.Mock).mock.calls[0];
      // Item1: 10 * 100 * 1.18 = 1180
      // Item2: 5 * 200 * 1.05 = 1050
      // Total: 2230
      expect(poCall[1]).toContain('2230.00');
    });

    it('should handle freight amount', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(1);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          vendor_name: 'Vendor',
          freight_amount: 5000,
          items: [{ name: 'Item', qty: 1, rate: 100, gst: 18 }],
          created_by: 'User',
        }),
      });

      await createPO(req);

      const poCall = (sheets.appendRow as jest.Mock).mock.calls[0];
      expect(poCall[1]).toContain('Yes'); // Has_Freight
      expect(poCall[1]).toContain('5000'); // Freight_Amount
    });

    it('should handle installation amount', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(1);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          vendor_name: 'Vendor',
          installation_amount: 10000,
          items: [{ name: 'Item', qty: 1, rate: 100, gst: 18 }],
          created_by: 'User',
        }),
      });

      await createPO(req);

      const poCall = (sheets.appendRow as jest.Mock).mock.calls[0];
      expect(poCall[1]).toContain('Yes'); // Has_Installation
      expect(poCall[1]).toContain('10000'); // Installation_Amount
    });

    it('should update PR status to PO_POSTED', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID', 'Status_Code']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(2);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          vendor_name: 'Vendor',
          items: [{ name: 'Item', qty: 1, rate: 100, gst: 18 }],
          created_by: 'User',
        }),
      });

      await createPO(req);

      expect(sheets.findRowIndex).toHaveBeenCalled();
      expect(sheets.updateRow).toHaveBeenCalled();
    });

    it('should handle multiple PO items', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(1);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const items = [
        { name: 'Item1', qty: 5, rate: 100, gst: 18, uom: 'Units' },
        { name: 'Item2', qty: 10, rate: 200, gst: 5, uom: 'Boxes' },
        { name: 'Item3', qty: 1, rate: 50000, gst: 28, uom: 'Units' },
      ];

      const req = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: 'PR-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          vendor_name: 'Vendor',
          items,
          created_by: 'User',
        }),
      });

      await createPO(req);

      // Should call appendRow: 1 for PO_Master + 3 for items
      expect(sheets.appendRow).toHaveBeenCalledTimes(4);
    });
  });

  describe('GET /api/pos - List POs', () => {
    it('should return POs with delivery status enrichment', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['PO_ID'], ['PO-001']])
        .mockResolvedValueOnce([['GRN_ID']])
        .mockResolvedValueOnce([['GRN_Items_ID']])
        .mockResolvedValueOnce([['PO_Items_ID'], ['Item1']]);

      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Site: 'Mumbai' }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Qty: 10 }]);

      const req = new NextRequest('http://localhost:3000/api/pos');
      const response = await getPOs(req);
      const data = await response.json();

      expect(data.pos).toBeDefined();
      expect(data.pos[0].received_pct).toBeDefined();
    });

    it('should filter by site', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID', 'Site']]);
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Site: 'Mumbai' }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/pos?site=Mumbai');
      const response = await getPOs(req);
      const data = await response.json();

      expect(data.pos[0].Site).toBe('Mumbai');
    });

    it('should filter by status', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID', 'Status_Code']]);
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Status_Code: 'PO_POSTED' }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/pos?status=PO_POSTED');
      const response = await getPOs(req);
      const data = await response.json();

      expect(data.pos[0].Status_Code).toBe('PO_POSTED');
    });

    it('should calculate delivery percentage', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ PO_ID: 'PO-001' }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Received_Qty: 50 }])
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Qty: 100 }]);

      const req = new NextRequest('http://localhost:3000/api/pos');
      const response = await getPOs(req);
      const data = await response.json();

      expect(data.pos[0].received_pct).toBe('50');
    });

    it('should calculate delay days when no GRNs received', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const dateString = pastDate.toLocaleDateString('en-IN');

      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ PO_ID: 'PO-001', Expected_Delivery_Date: `${dateString} 10:00:00` }])
        .mockReturnValueOnce([]) // No GRNs
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/pos');
      const response = await getPOs(req);
      const data = await response.json();

      expect(parseInt(data.pos[0].delay_days)).toBeGreaterThanOrEqual(5);
    });

    it('should show reverse order (newest first)', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([
          { PO_ID: 'PO-001' },
          { PO_ID: 'PO-002' },
          { PO_ID: 'PO-003' },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/pos');
      const response = await getPOs(req);
      const data = await response.json();

      expect(data.pos[0].PO_ID).toBe('PO-003');
    });
  });
});
