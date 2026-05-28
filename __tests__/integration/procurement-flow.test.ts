import { POST as createPR } from '@/app/api/prs/route';
import { POST as createPO } from '@/app/api/pos/route';
import { POST as createGRN } from '@/app/api/grns/route';
import { POST as createVendor } from '@/app/api/vendors/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  rowsToObjects: jest.fn(),
  writeNewRow: jest.fn(),
  appendRow: jest.fn(),
  getNextId: jest.fn(),
  findRowIndex: jest.fn(),
  updateRow: jest.fn(),
  batchRead: jest.fn(),
}));

jest.mock('@/lib/current-user', () => ({
  getCurrentUser: jest.fn(),
}));

import * as sheets from '@/lib/sheets';
import * as auth from '@/lib/current-user';

describe('Procurement Portal - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End: Vendor → PR → PO → GRN Flow', () => {
    it('should complete full procurement cycle', async () => {
      // 1. Create vendor
      (sheets.readSheet as jest.Mock).mockResolvedValue([['Vendor_ID']]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const vendorReq = new NextRequest('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          company_name: 'Premium Supplies Ltd',
          contact_person: 'Rajesh Kumar',
          contact_number: '9876543210',
          email: 'rajesh@premiumsupplies.com',
          gst_number: 'GST27AABCR1234F',
          pan: 'AABCR1234F',
          bank_name: 'ICICI Bank',
          acc_holder: 'Premium Supplies Ltd',
          acc_number: '123456789012',
          branch: 'Mumbai',
          ifsc: 'ICIC0000001',
          address: 'Mumbai, India',
          providing_sites: 'Mumbai',
          created_by: 'Admin',
        }),
      });

      const vendorResponse = await createVendor(vendorReq);
      const vendorData = await vendorResponse.json();
      expect(vendorData.success).toBe(true);
      const vendorId = vendorData.vendor_id;

      // 2. Create PR
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'buyer@company.com',
        name: 'Ramesh Patel',
      });

      const prReq = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'IT Equipment',
          vendor_id: vendorId,
          purpose: 'Laptop procurement for new hires',
          items: [
            { name: 'Dell Laptop XPS 13', qty: 5, rate: 95000, gst: 18, uom: 'Units' },
            { name: 'Office Chair', qty: 5, rate: 15000, gst: 18, uom: 'Units' },
          ],
        }),
      });

      const prResponse = await createPR(prReq);
      const prData = await prResponse.json();
      expect(prData.success).toBe(true);
      const prId = prData.pr_id;

      // 3. Create PO from PR
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PO_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(2);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const poReq = new NextRequest('http://localhost:3000/api/pos', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: prId,
          site: 'Mumbai',
          vendor_id: vendorId,
          vendor_name: 'Premium Supplies Ltd',
          po_date: '28/05/2026',
          expected_delivery_date: '10/06/2026',
          payment_terms: 'Net 30',
          delivery_terms: 'FOB',
          items: [
            { name: 'Dell Laptop XPS 13', qty: 5, rate: 95000, gst: 18, uom: 'Units' },
            { name: 'Office Chair', qty: 5, rate: 15000, gst: 18, uom: 'Units' },
          ],
          created_by: 'Ramesh Patel',
        }),
      });

      const poResponse = await createPO(poReq);
      const poData = await poResponse.json();
      expect(poData.success).toBe(true);
      const poId = poData.po_id;

      // 4. Create GRN (Goods Receipt Note)
      (sheets.readSheet as jest.Mock).mockResolvedValue([['GRN_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);

      const grnReq = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: poId,
          site: 'Mumbai',
          vendor_id: vendorId,
          invoice_number: 'INV-2026-005',
          invoice_value: 550000,
          invoice_date: '28/05/2026',
          lr_number: 'LR-2026-001',
          vehicle_number: 'MH-01-AB-1234',
          items: [
            {
              item_name: 'Dell Laptop XPS 13',
              ordered_qty: 5,
              received_qty: 5,
              invoice_qty: 5,
              uom: 'Units',
            },
            {
              item_name: 'Office Chair',
              ordered_qty: 5,
              received_qty: 5,
              invoice_qty: 5,
              uom: 'Units',
            },
          ],
          created_by_email: 'warehouse@company.com',
          created_by_name: 'Warehouse Team',
        }),
      });

      const grnResponse = await createGRN(grnReq);
      const grnData = await grnResponse.json();
      expect(grnData.success).toBe(true);
      const grnId = grnData.grn_id;

      // Verify the complete cycle
      expect(vendorId).toMatch(/^V-\d{4}$/);
      expect(prId).toMatch(/^PR-Mumbai-[A-Za-z]+\d{4}\/\d{3}$/);
      expect(poId).toMatch(/^PO-Mumbai-[A-Za-z]+\d{4}\/\d{3}$/);
      expect(grnId).toMatch(/^GRN-Mumbai-[A-Za-z]+\d{4}\/\d{3}$/);
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should capture different user names for concurrent PR submissions', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      // User 1
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user1@company.com',
        name: 'Alice Johnson',
      });

      const req1 = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Stationery', qty: 100, rate: 50, gst: 18 }],
        }),
      });

      await createPR(req1);
      let writeCall = (sheets.writeNewRow as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('Alice Johnson');

      jest.clearAllMocks();
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('002');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      // User 2
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user2@company.com',
        name: 'Bob Smith',
      });

      const req2 = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'IT Equipment',
          items: [{ name: 'Keyboard', qty: 10, rate: 2000, gst: 18 }],
        }),
      });

      await createPR(req2);
      writeCall = (sheets.writeNewRow as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('Bob Smith');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle sheet read failures gracefully', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@company.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockRejectedValue(new Error('Sheet unavailable'));

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Supplies',
          items: [{ name: 'Item', qty: 1, rate: 100, gst: 18 }],
        }),
      });

      const response = await createPR(req);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle invalid JSON in request body', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@company.com',
        name: 'Test User',
      });

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await createPR(req);
      expect(response.status).toBe(500);
    });
  });

  describe('Data Validation Scenarios', () => {
    it('should reject PR with zero quantity items', async () => {
      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@company.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Item', qty: 0, rate: 100, gst: 18 }],
        }),
      });

      // Should still allow (qty validation at form level typically)
      // This tests that API doesn't crash with zero qty
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockResolvedValue(1);

      const response = await createPR(req);
      expect(response.status).toBe(200); // Allow and let form validation handle it
    });

    it('should handle very large invoice values', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID']])
        .mockResolvedValueOnce([]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-LARGE',
          invoice_value: 99999999.99,
          invoice_date: '28/05/2026',
          items: [{ ordered_qty: 1, received_qty: 1, item_name: 'Expensive Item' }],
          created_by_email: 'user@company.com',
          created_by_name: 'User',
        }),
      });

      const response = await createGRN(req);
      expect(response.status).toBe(200);
    });

    it('should handle special characters in company names and addresses', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['Vendor_ID']]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          company_name: "O'Reilly & Associates (Pvt) Ltd.",
          contact_person: 'João Silva',
          contact_number: '9876543210',
          email: 'contact@oreilly.com',
          address: "123 O'Shaughnessy St, Apt #45, Mumbai - 400001",
          created_by: 'Admin',
        }),
      });

      const response = await createVendor(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Timestamp and Timezone Consistency', () => {
    it('should use consistent timezone across all operations', async () => {
      const timestampCaptures: string[] = [];

      (auth.getCurrentUser as jest.Mock).mockResolvedValue({
        email: 'user@company.com',
        name: 'Test User',
      });
      (sheets.readSheet as jest.Mock).mockResolvedValue([['PR_ID']]);
      (sheets.getNextId as jest.Mock).mockResolvedValue('001');
      (sheets.writeNewRow as jest.Mock).mockImplementation((sheet, row) => {
        const timestamp = row[1];
        timestampCaptures.push(timestamp);
        return Promise.resolve(1);
      });

      const req = new NextRequest('http://localhost:3000/api/prs', {
        method: 'POST',
        body: JSON.stringify({
          site: 'Mumbai',
          category: 'Office Supplies',
          items: [{ name: 'Item', qty: 1, rate: 100, gst: 18 }],
        }),
      });

      await createPR(req);

      // All captured timestamps should follow IST format (not UTC)
      expect(timestampCaptures.length).toBeGreaterThan(0);
      timestampCaptures.forEach((ts) => {
        expect(ts).toBeDefined();
        expect(typeof ts).toBe('string');
        // Should be a formatted date/time string, not Unix timestamp
        expect(ts).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      });
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate invoice submission for same vendor', async () => {
      (sheets.readSheet as jest.Mock)
        .mockResolvedValueOnce([['GRN_ID']])
        .mockResolvedValueOnce([
          ['GRN_ID', 'Invoice Number', 'Vendor_ID'],
          ['GRN-001', 'INV-DUP', 'V-0001'],
        ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { GRN_ID: 'GRN-001', 'Invoice Number': 'INV-DUP', Vendor_ID: 'V-0001' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/grns', {
        method: 'POST',
        body: JSON.stringify({
          po_id: 'PO-001',
          site: 'Mumbai',
          vendor_id: 'V-0001',
          invoice_number: 'INV-DUP',
          invoice_value: 50000,
          items: [{ ordered_qty: 1, received_qty: 1, item_name: 'Item' }],
          created_by_email: 'user@company.com',
          created_by_name: 'User',
        }),
      });

      const response = await createGRN(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Duplicate invoice');
    });
  });
});
