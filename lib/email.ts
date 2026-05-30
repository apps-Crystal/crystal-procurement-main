import nodemailer from 'nodemailer';
import { readSheet, rowsToObjects } from '@/lib/sheets';

// Tab name in the spreadsheet — change here if your tab is named differently.
const EMAIL_CONFIG_SHEET = 'Email_Config';

interface EmailConfig {
  Event_Key: string;
  Event_Label: string;
  Fixed_To: string;
  Fixed_CC: string;
  Fixed_BCC: string;
  Enabled: string;
  Notes: string;
}

async function getEmailConfig(eventKey: string): Promise<EmailConfig | null> {
  try {
    const rows = await readSheet(EMAIL_CONFIG_SHEET);
    const configs = rowsToObjects(rows) as unknown as EmailConfig[];
    const cfg = configs.find(c => c.Event_Key === eventKey);
    if (!cfg) return null;
    const enabled = (cfg.Enabled || '').toString().trim().toLowerCase();
    if (!['yes', 'true', '1', 'y'].includes(enabled)) return null;
    return cfg;
  } catch (err) {
    console.error(`Failed to read ${EMAIL_CONFIG_SHEET}:`, err);
    return null;
  }
}

function splitAddresses(s: string): string[] {
  return (s || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[email] SMTP_HOST / SMTP_USER / SMTP_PASS not all set; cannot send');
    return null;
  }

  // port 465 → implicit TLS, anything else → STARTTLS upgrade
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export async function sendEventEmail(opts: {
  eventKey: string;
  subject: string;
  html: string;
}): Promise<void> {
  const cfg = await getEmailConfig(opts.eventKey);
  if (!cfg) {
    console.log(`[email] No enabled config for event ${opts.eventKey} — skipping`);
    return;
  }
  const to = splitAddresses(cfg.Fixed_To);
  if (to.length === 0) {
    console.warn(`[email] Event ${opts.eventKey} has no Fixed_To recipients`);
    return;
  }
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
  try {
    await transporter.sendMail({
      from,
      to,
      cc: splitAddresses(cfg.Fixed_CC),
      bcc: splitAddresses(cfg.Fixed_BCC),
      subject: opts.subject,
      html: opts.html,
    });
    console.log(`[email] Sent ${opts.eventKey} to ${to.join(', ')}`);
  } catch (err) {
    console.error(`[email] Send failed for ${opts.eventKey}:`, err);
  }
}

function row(label: string, value: any): string {
  if (value === '' || value == null) return '';
  return `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">${label}</td><td style="padding:6px 12px;color:#0f172a;font-size:13px;border-bottom:1px solid #f1f5f9;font-weight:500;">${String(value)}</td></tr>`;
}

export function buildPrSubmittedEmail(pr: {
  pr_id: string;
  site: string;
  category: string;
  procurement_type: string;
  requested_by: string;
  vendor_name?: string;
  vendor_id?: string;
  pr_purpose?: string;
  total_incl_gst: string;
  expected_delivery?: string;
  payment_terms?: string;
  app_base_url?: string;
}): { subject: string; html: string } {
  const subject = `[Procurement] New PR Submitted — ${pr.pr_id} (${pr.site})`;
  const link = pr.app_base_url
    ? `${pr.app_base_url.replace(/\/$/, '')}/prs/${encodeURIComponent(pr.pr_id)}`
    : '';
  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;">
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#64748b;letter-spacing:1px;font-weight:bold;margin-bottom:8px;">NEW PURCHASE REQUEST</div>
    <div style="font-size:20px;font-weight:bold;color:#0f172a;font-family:monospace;">${pr.pr_id}</div>
    <div style="font-size:14px;color:#475569;margin-top:4px;">${pr.site} &middot; ${pr.category} &middot; Raised by ${pr.requested_by}</div>

    <table style="width:100%;border-collapse:collapse;margin-top:20px;">
      ${row('Procurement Type', pr.procurement_type)}
      ${row('Vendor', pr.vendor_name || pr.vendor_id)}
      ${row('Purpose', pr.pr_purpose)}
      ${row('Expected Delivery', pr.expected_delivery)}
      ${row('Payment Terms', pr.payment_terms)}
      ${row('Total (incl. GST)', `&#8377;${pr.total_incl_gst}`)}
    </table>

    ${link ? `<div style="margin-top:24px;"><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View PR &rarr;</a></div>` : ''}
  </div>
  <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">Crystal Group &middot; Procurement Portal</div>
</div>`;
  return { subject, html };
}
