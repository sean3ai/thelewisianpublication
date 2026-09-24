const SHEET_NAME = "Sheet1";

// Dedicated inbox that receives the PDF of every request
const DEDICATED_EMAIL = "seanestareja@gmail.com"; // <-- change this

// Optional: Drive folder ID to also archive PDFs (leave "" to skip)
const PDF_FOLDER_ID = "";

function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEET_NAME);

    const coverage = e.parameters.coverage
      ? e.parameters.coverage.join(", ")
      : "";

    const name = e.parameter.name || "";
    const email = e.parameter.email || "";
    const organization = e.parameter.organization || "";
    const event = e.parameter.event || "";
    const date = e.parameter.date || "";
    const time = e.parameter.time || "";
    const location = e.parameter.location || "";
    const message = e.parameter.message || "";

    const data = { name, email, organization, event, date, time, location, coverage, message };
    const submittedAt = new Date();
    const refNo = "LEW-" + Utilities.formatDate(submittedAt, Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");

    // ==============================
    // SAVE TO GOOGLE SHEET
    // ==============================
    sheet.appendRow([
      submittedAt, name, email, organization, event,
      date, time, location, coverage, message, "Pending"
    ]);

    // ==============================
    // CREATE PDF
    // ==============================
    const pdfBlob = createRequestPdf_(data, refNo, submittedAt);

    if (PDF_FOLDER_ID) {
      DriveApp.getFolderById(PDF_FOLDER_ID).createFile(pdfBlob);
    }

    // ==============================
    // EMAIL PDF TO DEDICATED ADDRESS
    // ==============================
    MailApp.sendEmail({
      to: DEDICATED_EMAIL,
      replyTo: email,
      subject: `New Coverage Request [${refNo}]: ${event}`,
      htmlBody: `
        <p>A new publication coverage request has been submitted.</p>
        <p><strong>Reference:</strong> ${refNo}<br>
           <strong>From:</strong> ${esc_(name)} (${esc_(email)})<br>
           <strong>Event:</strong> ${esc_(event)}</p>
        <p>The full request is attached as a PDF.</p>
      `,
      attachments: [pdfBlob]
    });

    // ==============================
    // CONFIRMATION EMAIL TO REQUESTER (with PDF copy)
    // ==============================
    if (email) {
      MailApp.sendEmail({
        to: email,
        subject: `The Lewisian Publication Request Form [${refNo}]`,
        htmlBody: `
          <h2>The Lewisian</h2>
          <p>Hello <strong>${esc_(name)}</strong>,</p>
          <p>Your publication coverage request has been successfully received.
             A PDF copy is attached for your records.</p>

          <h3>Request Details</h3>
          <p><strong>Reference No.:</strong> ${refNo}</p>
          <p><strong>Event:</strong> ${esc_(event)}</p>
          <p><strong>Date:</strong> ${esc_(date)}</p>
          <p><strong>Start Time:</strong> ${esc_(time)}</p>
          <p><strong>Location:</strong> ${esc_(location)}</p>
          <p><strong>Coverage Needed:</strong> ${esc_(coverage)}</p>
          <p><strong>Message:</strong> ${esc_(message)}</p>
          <p><strong>Status:</strong> Pending review</p>

          <p>The Editorial Board will review your request and provide
             further instructions once it has been verified.</p>

          <p>Thank you,<br>
             <strong>The Lewisian</strong><br>
             Publication Office<br>
             The Lewis College<br>
             Sorsogon City, Sorsogon</p>
        `,
        attachments: [pdfBlob]
      });
    }

    return json_({
      success: true,
      message: "Request submitted. PDF generated and emailed."
    });

  } catch (error) {
    return json_({ success: false, error: error.toString() });
  }
}

// ==============================
// HELPERS
// ==============================

function createRequestPdf_(d, refNo, submittedAt) {
  const stamp = Utilities.formatDate(
    submittedAt, Session.getScriptTimeZone(), "MMMM d, yyyy h:mm a"
  );

  const row = (label, value) => `
    <tr>
      <td style="width:32%;padding:8px;border:1px solid #ccc;background:#f3f3f3;font-weight:bold;vertical-align:top;">${label}</td>
      <td style="padding:8px;border:1px solid #ccc;vertical-align:top;">${esc_(value)}</td>
    </tr>`;

  const html = `
    <html>
      <body style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;">
        <div style="text-align:center;">
          <h1 style="margin:0;">The Lewisian</h1>
          <div>Publication Office &middot; The Lewis College &middot; Sorsogon City, Sorsogon</div>
          <h2 style="margin-top:18px;">Publication Coverage Request</h2>
        </div>

        <p><strong>Reference No.:</strong> ${refNo}<br>
           <strong>Submitted:</strong> ${stamp}<br>
           <strong>Status:</strong> Pending review</p>

        <table style="width:100%;border-collapse:collapse;">
          ${row("Requester Name", d.name)}
          ${row("Email", d.email)}
          ${row("Organization", d.organization)}
          ${row("Event", d.event)}
          ${row("Date", d.date)}
          ${row("Start Time", d.time)}
          ${row("Location", d.location)}
          ${row("Coverage Needed", d.coverage)}
          ${row("Message", d.message)}
        </table>

        <p style="margin-top:40px;font-size:10px;color:#777;">
          This document was generated automatically by The Lewisian request system.
        </p>
      </body>
    </html>`;

  return Utilities
    .newBlob(html, "text/html", "request.html")
    .getAs("application/pdf")
    .setName(`Coverage Request - ${refNo}.pdf`);
}

// Escape user input so it can't inject HTML into the PDF or emails
function esc_(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================
// RUN THIS ONCE TO GRANT PERMISSIONS
// ==============================
function authorize() {
  MailApp.getRemainingDailyQuota();      // triggers the email permission
  DriveApp.getRootFolder();              // triggers the Drive permission
  SpreadsheetApp.getActiveSpreadsheet(); // triggers the Sheets permission
}
