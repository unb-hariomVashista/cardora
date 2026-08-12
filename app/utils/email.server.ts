import nodemailer from "nodemailer";

interface GiftCardDetails {
  code: string;
  expiresOn: string | null;
  initialValue: {
    amount: string;
    currencyCode: string;
  };
}

export async function sendGiftCardsEmail(
  toEmail: string,
  shopName: string,
  giftCards: GiftCardDetails[]
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpSecure = process.env.SMTP_SECURE === "true";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"Cardora Gift Cards" <no-reply@example.com>`;

  // Validate if configuration exists
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      "[Cardora Email Warning] SMTP credentials are not configured in your .env file. " +
        "Skipping email delivery. To enable email notifications, configure SMTP_HOST, SMTP_USER, and SMTP_PASS."
    );
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const formatCurrency = (amount: string, currencyCode: string) => {
      const num = parseFloat(amount) || 0;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      }).format(num);
    };

    const formatDate = (dateString: string | null) => {
      if (!dateString) return "No expiry";
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    // Construct table rows for HTML and text content
    const rowsHtml = giftCards
      .map(
        (card) => `
        <tr>
          <td><span class="code-badge">${card.code}</span></td>
          <td class="amount">${formatCurrency(card.initialValue.amount, card.initialValue.currencyCode)}</td>
          <td>${formatDate(card.expiresOn)}</td>
        </tr>
      `
      )
      .join("");

    const textContent = giftCards
      .map(
        (card) =>
          `Code: ${card.code} | Value: ${formatCurrency(
            card.initialValue.amount,
            card.initialValue.currencyCode
          )} | Expires: ${formatDate(card.expiresOn)}`
      )
      .join("\n");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Generated Gift Cards</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f9fafb;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 32px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px;
    }
    .content h2 {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .content p {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .table-container {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #374151;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 16px;
      font-size: 14px;
      color: #1f2937;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .code-badge {
      font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
      font-weight: 700;
      color: #4f46e5;
      background-color: #e0e7ff;
      padding: 4px 8px;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
    .amount {
      font-weight: 600;
      color: #111827;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Cardora Gift Card Manager</h1>
        <p>New Gift Cards Generated Successfully</p>
      </div>
      <div class="content">
        <h2>Hello, ${shopName}</h2>
        <p>You have successfully generated a new batch of gift cards. Below are the details and codes for the gift cards that were created:</p>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Value</th>
                <th>Expires On</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        
        <p>Please store these codes securely. You can view, disable, or manage these gift cards at any time directly in your Cardora dashboard inside your Shopify Admin.</p>
      </div>
      <div class="footer">
        <p>This email was sent automatically by Cardora Gift Card Manager.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    await transporter.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: `[Cardora] New Gift Cards Generated for ${shopName}`,
      text: `Hello ${shopName},\n\nYou have successfully generated a new batch of gift cards. Here are the details:\n\n${textContent}\n\nPlease store these codes securely.`,
      html: htmlContent,
    });

    console.log(`[Cardora Email Success] Gift cards notification email successfully sent to ${toEmail}`);
  } catch (error) {
    console.error("[Cardora Email Error] Failed to send gift cards email:", error);
  }
}
