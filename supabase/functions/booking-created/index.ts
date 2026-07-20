import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, PDFName, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "orders@phoenix-hibachi.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Phoenix Hibachi <orders@phoenix-hibachi.com>";
const SITE_PHONE = Deno.env.get("SITE_PHONE") || "(516) 518-3325";
const SITE_URL = Deno.env.get("SITE_URL") || "https://phoenix-hibachi.com";
const BOOKING_EMAIL = Deno.env.get("BOOKING_EMAIL") || "booking@phoenix-hibachi.com";
const BUCKET = Deno.env.get("ORDER_PDF_BUCKET") || "order-pdfs";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Booking = Record<string, any>;

function value(v: any, fallback = "-") {
  return v === null || v === undefined || v === "" ? fallback : String(v);
}

function esc(v: any) {
  return value(v, "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c] || c));
}

function phoneHref(v: any) {
  const digits = value(v, "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `tel:+1${digits}` : "";
}

function mapHref(v: any) {
  const address = value(v, "");
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";
}

function websiteLabel(v: any) {
  return value(v, "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function linked(label: any, href: string, fallback = "-") {
  const shown = value(label, fallback);
  return href && shown !== fallback
    ? `<a href="${esc(href)}" style="color:#0645ad;text-decoration:underline;font-weight:700">${esc(shown)}</a>`
    : esc(shown);
}

function money(v: any) {
  const n = Number(v || 0);
  return `$${n.toFixed(2)}`;
}

function moneyField(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(String(value).replace(/[$,]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function centsField(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(String(value).replace(/[$,]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, n / 100);
  }
  return 0;
}

function displayText(v: any) {
  if (Array.isArray(v)) return v.map(item => typeof item === "string" ? item : value(item?.name || item?.title || JSON.stringify(item))).filter(Boolean).join(", ");
  if (v && typeof v === "object") return Object.entries(v).map(([key, val]) => `${key}: ${value(val, "")}`).filter(part => !part.endsWith(": ")).join(", ");
  return value(v, "");
}

function noteValue(b: Booking, label: string) {
  const safe = String(label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const notes = [b.service_notes, b.admin_notes, b.customer_notes, b.special_requests].map(x => value(x, "")).filter(Boolean).join("\n");
  const match = notes.match(new RegExp(`(?:^|\\n)${safe}:\\s*([^\\n]+)`, "i"));
  return match ? match[1].trim() : "";
}

function njTollFee(b: Booking) {
  return moneyField(b.nj_toll_fee, b.njTollFee, b.toll_fee, b.tollFee, noteValue(b, "NJ Toll Fee"), noteValue(b, "New Jersey Toll Fee"));
}

function paidAmount(b: Booking) { return moneyField(b.paid_amount, b.deposit_amount, b.amount_paid); }
function balanceDue(b: Booking) { return centsField(b.balance_due_cents) || moneyField(b.balance_due, b.balanceDue); }
function finalTotal(b: Booking) { return moneyField(b.final_total, b.finalTotal, centsField(b.order_total_cents)) || Math.max(0, paidAmount(b) + balanceDue(b)); }
function notesSummary(b: Booking) { return value(b.service_notes || b.customer_notes || b.special_requests || b.admin_notes, "").slice(0, 700); }

function bookingHtml(b: Booking, pdfUrl?: string) {
  const number = value(b.booking_number || b.id);
  const toll = njTollFee(b);
  const address = value(b.address, "");
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f160f">
    <h2 style="margin:0 0 8px;color:#8a4f10">Phoenix Hibachi Booking Confirmation</h2>
    <p style="margin:0 0 12px;color:#6b4a18"><b>Website:</b> ${linked(websiteLabel(SITE_URL), SITE_URL)} · <b>Text/Call:</b> ${linked(SITE_PHONE, phoneHref(SITE_PHONE))} · <b>Email:</b> ${linked(BOOKING_EMAIL, `mailto:${BOOKING_EMAIL}`)}</p>
    <p>Thank you for your booking request. Phoenix Hibachi will review the details and confirm the final arrival window.</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;width:100%;max-width:720px">
      <tr><td><b>Order #</b></td><td>${number}</td></tr>
      <tr><td><b>Name</b></td><td>${value(b.customer_name)}</td></tr>
      <tr><td><b>Phone</b></td><td>${linked(b.customer_phone, phoneHref(b.customer_phone))}</td></tr>
      <tr><td><b>Email</b></td><td>${linked(b.customer_email, b.customer_email ? `mailto:${b.customer_email}` : "")}</td></tr>
      <tr><td><b>Date</b></td><td>${value(b.event_date)}</td></tr>
      <tr><td><b>Time</b></td><td>${value(b.event_time)}</td></tr>
      <tr><td><b>Address</b></td><td>${linked(address, mapHref(address))}</td></tr>
      <tr><td><b>Guests</b></td><td>${value(b.adults, '0')} adults · ${value(b.kids, '0')} kids</td></tr>
      <tr><td><b>Package</b></td><td>${value(b.package_name)}</td></tr>
      <tr><td><b>Add-ons</b></td><td>${displayText(b.add_ons) || "-"}</td></tr>
      <tr><td><b>Protein selections</b></td><td>${displayText(b.protein_summary || b.protein_selections) || "-"}</td></tr>
      <tr><td><b>Allergies</b></td><td>${displayText(b.allergies || b.allergy_notes) || "-"}</td></tr>
      <tr><td><b>Travel Fee</b></td><td>${money(b.travel_fee)}</td></tr>
      ${toll > 0 ? `<tr><td><b>NJ Toll Fee</b></td><td>${money(toll)}</td></tr>` : ""}
      <tr><td><b>Sales Tax</b></td><td>${money(b.sales_tax)}</td></tr>
      <tr><td><b>Final Total</b></td><td><b>${money(finalTotal(b))}</b></td></tr>
      <tr><td><b>Paid</b></td><td>${money(paidAmount(b))}</td></tr>
      <tr><td><b>Balance Due</b></td><td><b>${money(balanceDue(b))}</b></td></tr>
      <tr><td><b>Payment Status</b></td><td>${value(b.payment_status || b.status)}</td></tr>
      <tr><td><b>Deposit Status</b></td><td>${value(b.deposit_status)}</td></tr>
      <tr><td><b>Notes</b></td><td>${value(notesSummary(b))}</td></tr>
    </table>
    ${pdfUrl ? `<p><a href="${esc(pdfUrl)}">Download PDF invoice</a></p>` : ""}
    <p>Questions? Call or text ${linked(SITE_PHONE, phoneHref(SITE_PHONE))}, email ${linked(BOOKING_EMAIL, `mailto:${BOOKING_EMAIL}`)}, or visit ${linked(websiteLabel(SITE_URL), SITE_URL)}.</p>
    <p style="font-size:12px;color:#7a5a2a">Coupons cannot be combined. Gift card/wallet credits are payment methods, not coupons. Zelle payments must be manually confirmed by Phoenix Hibachi before the balance is marked paid.</p>
  </div>`;
}

async function makePdf(b: Booking): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 740;
  function addPdfLink(x: number, linkY: number, width: number, height: number, uri: string) {
    if (!uri) return;
    const annotation = pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, linkY - 2, x + width, linkY + height],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: uri },
    });
    const annots = page.node.Annots();
    if (annots) annots.push(annotation);
    else page.node.set(PDFName.of("Annots"), pdf.context.obj([annotation]));
  }
  const draw = (text: string, size = 11, isBold = false) => {
    page.drawText(text.slice(0, 95), { x: 54, y, size, font: isBold ? bold : font, color: rgb(0.12, 0.09, 0.06) });
    y -= size + 9;
  };
  const drawLinked = (line: string, href: string, size = 11, isBold = false) => {
    const shown = line.slice(0, 95);
    const activeFont = isBold ? bold : font;
    page.drawText(shown, { x: 54, y, size, font: activeFont, color: rgb(0.02, 0.27, 0.68) });
    addPdfLink(54, y, Math.min(activeFont.widthOfTextAtSize(shown, size), 500), size + 4, href);
    y -= size + 9;
  };
  page.drawText("PHOENIX HIBACHI", { x: 82, y: 405, size: 44, font: bold, color: rgb(0.95, 0.82, 0.48), opacity: 0.10, rotate: degrees(-28) });
  draw("PHOENIX HIBACHI", 20, true);
  draw(`Order PDF / Booking Confirmation`, 13, true);
  y -= 8;
  const rows = [
    ["Order #", value(b.booking_number || b.id)],
    ["Customer", value(b.customer_name)],
    ["Phone", value(b.customer_phone)],
    ["Email", value(b.customer_email)],
    ["Date", value(b.event_date)],
    ["Time", value(b.event_time)],
    ["Address", value(b.address)],
    ["Guests", `${value(b.adults, "0")} adults · ${value(b.kids, "0")} kids`],
    ["Package", value(b.package_name)],
    ["Add-ons", Array.isArray(b.add_ons) ? b.add_ons.map((x: any) => x.name || x).join(", ") : value(b.add_ons)],
    ["Allergies", Array.isArray(b.allergies) ? b.allergies.join(", ") : value(b.allergies)],
    ["Proteins", displayText(b.protein_summary || b.protein_selections)],
    ["Food Subtotal", money(b.food_subtotal)],
    ["Travel Fee", money(b.travel_fee)],
    ["NJ Toll Fee", money(njTollFee(b))],
    ["Sales Tax", money(b.sales_tax)],
    ["Final Total", money(finalTotal(b))],
    ["Paid", money(paidAmount(b))],
    ["Balance Due", money(balanceDue(b))],
    ["Payment Status", value(b.payment_status)],
    ["Deposit Status", value(b.deposit_status)],
    ["Status", value(b.status)],
    ["Notes", value(notesSummary(b))],
  ];
  for (const [label, text] of rows) {
    if (y < 80) { y = 740; pdf.addPage([612,792]); }
    const href = label === "Address" ? mapHref(text) : label === "Phone" ? phoneHref(text) : label === "Email" ? `mailto:${text}` : "";
    if (href) drawLinked(`${label}: ${text}`, href, 11, label === "Order #");
    else draw(`${label}: ${text}`, 11, label === "Order #");
  }
  y -= 12;
  drawLinked(`Phoenix Hibachi website: ${websiteLabel(SITE_URL)}`, SITE_URL, 10, true);
  drawLinked(`Call/Text Phoenix Hibachi: ${SITE_PHONE}`, phoneHref(SITE_PHONE), 10, true);
  drawLinked(`Email Phoenix Hibachi: ${BOOKING_EMAIL}`, `mailto:${BOOKING_EMAIL}`, 10, true);
  draw("This PDF was generated automatically by Phoenix Hibachi booking system.", 9);
  draw("Coupons cannot be combined. Zelle payments require manual confirmation.", 9);
  return await pdf.save();
}

async function sendEmail(to: string, subject: string, html: string, pdfBytes?: Uint8Array, filename?: string) {
  if (!RESEND_API_KEY) return { skipped: true, reason: "RESEND_API_KEY not set" };
  const attachments = pdfBytes && filename ? [{ filename, content: btoa(String.fromCharCode(...pdfBytes)) }] : undefined;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, attachments }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const bookingNumber = body.booking_number || body.booking?.booking_number;
    if (!bookingNumber) throw new Error("booking_number is required");

    const { data: booking, error } = await supabase.from("bookings").select("*").eq("booking_number", bookingNumber).single();
    if (error || !booking) throw new Error(error?.message || "Booking not found");

    const pdfBytes = await makePdf(booking);
    const safeNumber = String(bookingNumber).replace(/[^a-z0-9_-]/gi, "-");
    const filePath = `${safeNumber}/Phoenix-Hibachi-Order-${safeNumber}.pdf`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

    const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 30);
    if (signError) throw new Error(`Signed URL failed: ${signError.message}`);
    const pdfUrl = signed.signedUrl;

    await supabase.from("bookings").update({ pdf_url: pdfUrl, pdf_path: filePath }).eq("booking_number", bookingNumber);

    const adminSubject = `New Phoenix Hibachi Booking ${bookingNumber}`;
    const customerSubject = `Phoenix Hibachi Booking Received: ${bookingNumber}`;
    const html = bookingHtml(booking, pdfUrl);

    await sendEmail(ADMIN_EMAIL, adminSubject, html, pdfBytes, `Phoenix-Hibachi-Order-${safeNumber}.pdf`);
    if (booking.customer_email) await sendEmail(booking.customer_email, customerSubject, html, pdfBytes, `Phoenix-Hibachi-Order-${safeNumber}.pdf`);

    return new Response(JSON.stringify({ ok: true, pdf_url: pdfUrl, pdf_path: filePath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
