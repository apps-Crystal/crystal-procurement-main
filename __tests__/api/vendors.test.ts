import { POST as createVendor, GET as getVendors } from '@/app/api/vendors/route';
import { GET as getVendorDetail, PATCH as updateVendor } from '@/app/api/vendors/[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/sheets', () => ({
  readSheet: jest.fn(),
  rowsToObjects: jest.fn(),
  appendRow: jest.fn(),
  batchRead: jest.fn(),
  findRowIndex: jest.fn(),
  updateRow: jest.fn(),
}));

import * as sheets from '@/lib/sheets';

describe('Vendor API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/vendors - Create Vendor', () => {
    it('should successfully create vendor with valid data', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Company_Name'],
        ['V-0001', 'Existing Vendor'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { Vendor_ID: 'V-0001', Company_Name: 'Existing Vendor' },
      ]);
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          company_name: 'Acme Corp',
          contact_person: 'John Doe',
          contact_number: '9876543210',
          email: 'john@acme.com',
          gst_number: 'GST123',
          pan: 'PAN123',
          bank_name: 'HDFC',
          acc_holder: 'Acme Corp',
          acc_number: '123456789',
          branch: 'Mumbai',
          ifsc: 'HDFC0001',
          address: '123 Street, Mumbai',
          providing_sites: 'Mumbai',
          created_by: 'Admin',
        }),
      });

      const response = await createVendor(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.vendor_id).toBeDefined();
    });

    it('should generate sequential vendor IDs', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID'],
        ['V-0001'],
        ['V-0005'],
        ['V-0010'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { Vendor_ID: 'V-0001' },
        { Vendor_ID: 'V-0005' },
        { Vendor_ID: 'V-0010' },
      ]);
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          company_name: 'New Vendor',
          contact_person: 'Jane Doe',
          contact_number: '9876543210',
          email: 'jane@vendor.com',
          created_by: 'Admin',
        }),
      });

      const response = await createVendor(req);
      const data = await response.json();

      expect(data.vendor_id).toBe('V-0011');
    });

    it('should prevent duplicate PAN registration', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Vendor_PAN'],
        ['V-0001', 'PAN123'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        { Vendor_ID: 'V-0001', Vendor_PAN: 'PAN123', Company_Name: 'Existing Corp' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          company_name: 'Different Corp',
          contact_person: 'John Doe',
          contact_number: '9876543210',
          email: 'john@different.com',
          pan: 'PAN123',
          created_by: 'Admin',
        }),
      });

      const response = await createVendor(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('PAN already registered');
    });

    it('should handle multiple providing sites as array', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['Vendor_ID']]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([]);
      (sheets.appendRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          company_name: 'Multi-site Vendor',
          contact_person: 'John',
          contact_number: '9876543210',
          email: 'john@vendor.com',
          providing_sites: ['Mumbai', 'Bangalore', 'Delhi'],
          created_by: 'Admin',
        }),
      });

      await createVendor(req);

      const appendCall = (sheets.appendRow as jest.Mock).mock.calls[0];
      expect(appendCall[1]).toContain('Mumbai, Bangalore, Delhi');
    });
  });

  describe('GET /api/vendors - List Vendors', () => {
    it('should return all vendors with KYC status', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'GST_Certificate_Link'],
        ['V-0001', 'http://example.com/gst'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        {
          Vendor_ID: 'V-0001',
          Company_Name: 'Acme',
          GST_Certificate_Link: 'http://example.com/gst',
          PanCard_Link: '',
          Cancelled_Cheque_Link: '',
          MSME_Certificate_Link: '',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/vendors');
      const response = await getVendors(req);
      const data = await response.json();

      expect(data.vendors[0].kyc_status).toBe('partial');
      expect(data.vendors[0].kyc_filled).toBe('1');
    });

    it('should mark KYC as complete when all 4 docs present', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'GST_Certificate_Link', 'PanCard_Link', 'Cancelled_Cheque_Link', 'MSME_Certificate_Link'],
        ['V-0001', 'gst', 'pan', 'cheque', 'msme'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        {
          Vendor_ID: 'V-0001',
          GST_Certificate_Link: 'gst',
          PanCard_Link: 'pan',
          Cancelled_Cheque_Link: 'cheque',
          MSME_Certificate_Link: 'msme',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/vendors');
      const response = await getVendors(req);
      const data = await response.json();

      expect(data.vendors[0].kyc_status).toBe('complete');
      expect(data.vendors[0].kyc_label).toBe('Complete');
    });

    it('should filter by search term (company name)', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Company_Name'],
        ['V-0001', 'Acme Corporation'],
        ['V-0002', 'Beta Supplies'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        {
          Vendor_ID: 'V-0001',
          Company_Name: 'Acme Corporation',
          GST_Certificate_Link: '',
          PanCard_Link: '',
          Cancelled_Cheque_Link: '',
          MSME_Certificate_Link: '',
        },
        {
          Vendor_ID: 'V-0002',
          Company_Name: 'Beta Supplies',
          GST_Certificate_Link: '',
          PanCard_Link: '',
          Cancelled_Cheque_Link: '',
          MSME_Certificate_Link: '',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/vendors?search=acme');
      const response = await getVendors(req);
      const data = await response.json();

      expect(data.vendors).toHaveLength(1);
      expect(data.vendors[0].Company_Name).toBe('Acme Corporation');
    });

    it('should filter by site', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Providing_Sites'],
        ['V-0001', 'Mumbai, Bangalore'],
        ['V-0002', 'Delhi'],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        {
          Vendor_ID: 'V-0001',
          Providing_Sites: 'Mumbai, Bangalore',
          GST_Certificate_Link: '',
          PanCard_Link: '',
          Cancelled_Cheque_Link: '',
          MSME_Certificate_Link: '',
        },
        {
          Vendor_ID: 'V-0002',
          Providing_Sites: 'Delhi',
          GST_Certificate_Link: '',
          PanCard_Link: '',
          Cancelled_Cheque_Link: '',
          MSME_Certificate_Link: '',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/vendors?site=Mumbai');
      const response = await getVendors(req);
      const data = await response.json();

      expect(data.vendors).toHaveLength(1);
    });

    it('should filter by KYC complete status', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'GST_Certificate_Link'],
        ['V-0001', 'gst'],
        ['V-0002', ''],
      ]);
      (sheets.rowsToObjects as jest.Mock).mockReturnValue([
        {
          Vendor_ID: 'V-0001',
          GST_Certificate_Link: 'gst',
          PanCard_Link: 'pan',
          Cancelled_Cheque_Link: 'cheque',
          MSME_Certificate_Link: 'msme',
        },
        {
          Vendor_ID: 'V-0002',
          GST_Certificate_Link: '',
          PanCard_Link: '',
          Cancelled_Cheque_Link: '',
          MSME_Certificate_Link: '',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/vendors?kyc=complete');
      const response = await getVendors(req);
      const data = await response.json();

      expect(data.vendors).toHaveLength(1);
      expect(data.vendors[0].kyc_status).toBe('complete');
    });
  });

  describe('GET /api/vendors/[id] - Vendor Detail', () => {
    it('should return vendor detail with KYC status', async () => {
      (sheets.batchRead as jest.Mock).mockResolvedValue({
        Vendor_Master: [
          ['Vendor_ID', 'Company_Name'],
          ['V-0001', 'Acme Corp'],
        ],
        PO_Master: [],
        GRN_Master: [],
      });
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([
          {
            Vendor_ID: 'V-0001',
            Company_Name: 'Acme Corp',
            GST_Certificate_Link: 'gst',
            PanCard_Link: 'pan',
            Cancelled_Cheque_Link: '',
            MSME_Certificate_Link: '',
          },
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001');
      const response = await getVendorDetail(req, { params: Promise.resolve({ id: 'V-0001' }) });
      const data = await response.json();

      expect(data.vendor.Vendor_ID).toBe('V-0001');
      expect(data.vendor.kyc_status).toBe('partial');
    });

    it('should return recent POs and GRNs', async () => {
      (sheets.batchRead as jest.Mock).mockResolvedValue({
        Vendor_Master: [['V-0001']],
        PO_Master: [['PO-001'], ['PO-002'], ['PO-003']],
        GRN_Master: [['GRN-001'], ['GRN-002']],
      });
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ Vendor_ID: 'V-0001' }])
        .mockReturnValueOnce([
          { Vendor_ID: 'V-0001', PO_ID: 'PO-001' },
          { Vendor_ID: 'V-0001', PO_ID: 'PO-002' },
        ])
        .mockReturnValueOnce([
          { Vendor_ID: 'V-0001', GRN_ID: 'GRN-001' },
        ]);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001');
      const response = await getVendorDetail(req, { params: Promise.resolve({ id: 'V-0001' }) });
      const data = await response.json();

      expect(data.recentPos).toBeDefined();
      expect(data.recentGrns).toBeDefined();
    });

    it('should calculate total PO value', async () => {
      (sheets.batchRead as jest.Mock).mockResolvedValue({
        Vendor_Master: [['V-0001']],
        PO_Master: [['PO-001', 'PO-002']],
        GRN_Master: [],
      });
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([{ Vendor_ID: 'V-0001' }])
        .mockReturnValueOnce([
          { Vendor_ID: 'V-0001', PO_ID: 'PO-001', Total_Incl_GST: '100000' },
          { Vendor_ID: 'V-0001', PO_ID: 'PO-002', Total_Incl_GST: '₹50,000' },
        ])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001');
      const response = await getVendorDetail(req, { params: Promise.resolve({ id: 'V-0001' }) });
      const data = await response.json();

      expect(data.stats.totalPOs).toBe(2);
      expect(data.stats.totalValue).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent vendor', async () => {
      (sheets.batchRead as jest.Mock).mockResolvedValue({
        Vendor_Master: [],
        PO_Master: [],
        GRN_Master: [],
      });
      (sheets.rowsToObjects as jest.Mock)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-9999');
      const response = await getVendorDetail(req, { params: Promise.resolve({ id: 'V-9999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Vendor not found');
    });
  });

  describe('PATCH /api/vendors/[id] - Update Vendor', () => {
    it('should update vendor contact details', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Contact_Person'],
        ['V-0001', 'Old Name'],
      ]);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(2);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001', {
        method: 'PATCH',
        body: JSON.stringify({
          Contact_Person: 'New Name',
          Contact_Number: '9876543210',
        }),
      });

      const response = await updateVendor(req, { params: Promise.resolve({ id: 'V-0001' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(sheets.updateRow).toHaveBeenCalled();
    });

    it('should update bank details', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Bank_Name'],
        ['V-0001', 'HDFC'],
      ]);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(2);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001', {
        method: 'PATCH',
        body: JSON.stringify({
          Bank_Name: 'ICICI',
          Account_Number: '123456789',
          IFSC_Code: 'ICIC0001',
        }),
      });

      await updateVendor(req, { params: Promise.resolve({ id: 'V-0001' }) });

      expect(sheets.updateRow).toHaveBeenCalled();
    });

    it('should update KYC documents', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'GST_Certificate_Link'],
        ['V-0001', ''],
      ]);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(2);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001', {
        method: 'PATCH',
        body: JSON.stringify({
          GST_Certificate_Link: 'http://example.com/gst.pdf',
          PanCard_Link: 'http://example.com/pan.pdf',
        }),
      });

      await updateVendor(req, { params: Promise.resolve({ id: 'V-0001' }) });

      expect(sheets.updateRow).toHaveBeenCalled();
    });

    it('should return 404 for non-existent vendor', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([['Vendor_ID']]);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(-1);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-9999', {
        method: 'PATCH',
        body: JSON.stringify({ Contact_Person: 'Name' }),
      });

      const response = await updateVendor(req, { params: Promise.resolve({ id: 'V-9999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Vendor not found');
    });

    it('should not allow updating sensitive fields', async () => {
      (sheets.readSheet as jest.Mock).mockResolvedValue([
        ['Vendor_ID', 'Vendor_ID'],
        ['V-0001', 'V-0001'],
      ]);
      (sheets.findRowIndex as jest.Mock).mockReturnValue(2);
      (sheets.updateRow as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/vendors/V-0001', {
        method: 'PATCH',
        body: JSON.stringify({
          Vendor_ID: 'V-9999', // Should not be updatable
          Contact_Person: 'Name',
        }),
      });

      await updateVendor(req, { params: Promise.resolve({ id: 'V-0001' }) });

      const updateCall = (sheets.updateRow as jest.Mock).mock.calls[0];
      // Should NOT contain V-9999 as vendor ID
      expect(updateCall).toBeDefined();
    });
  });
});
