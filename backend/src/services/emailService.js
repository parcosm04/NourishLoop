const nodemailer = require('nodemailer');

/**
 * Creates and caches a Nodemailer transporter.
 * Falls back to an Ethereal test inbox if no production SMTP is defined in .env.
 */
async function getTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Fallback to test account for instant testing without SMTP credentials
  console.log('No EMAIL_USER/EMAIL_PASS found in .env. Creating test email account (Ethereal)...');
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

/**
 * Sends a confirmation email to the user with a copy of all details they submitted.
 */
async function sendFeedbackConfirmation(feedbackData) {
  try {
    const transporter = await getTransporter();

    const {
      name,
      email,
      phone,
      organizationName,
      role,
      category,
      rating,
      message,
      createdAt
    } = feedbackData;

    const stars = '★'.repeat(rating || 5) + '☆'.repeat(Math.max(0, 5 - (rating || 5)));
    const submissionDate = new Date(createdAt || Date.now()).toLocaleString();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            background-color: #0f0f11;
            color: #f0f0f0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 24px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #1a1a1c;
            border: 1px solid #333333;
            border-radius: 8px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #1a1a1c, #2a2a2e);
            border-bottom: 2px solid #ccff00;
            padding: 28px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 26px;
            letter-spacing: -0.5px;
          }
          .header p {
            color: #888888;
            margin: 6px 0 0;
            font-size: 14px;
          }
          .body {
            padding: 28px;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 16px;
            color: #f0f0f0;
          }
          .intro {
            font-size: 14px;
            color: #aaaaaa;
            margin-bottom: 24px;
            line-height: 1.6;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            background-color: #141416;
            border-radius: 6px;
            overflow: hidden;
          }
          .details-table td {
            padding: 12px 16px;
            border-bottom: 1px solid #28282c;
            font-size: 14px;
          }
          .details-table td.label {
            color: #888888;
            width: 35%;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
          }
          .details-table td.value {
            color: #f0f0f0;
          }
          .message-box {
            background-color: #141416;
            border-left: 3px solid #ff6b35;
            padding: 16px;
            border-radius: 4px;
            margin-top: 8px;
            color: #e0e0e0;
            font-size: 14px;
            line-height: 1.6;
            white-space: pre-wrap;
          }
          .rating-badge {
            color: #ccff00;
            font-size: 16px;
            font-weight: bold;
          }
          .footer {
            border-top: 1px solid #28282c;
            padding: 20px 28px;
            font-size: 12px;
            color: #666666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Rescue.</h1>
            <p>Food Surplus Rescue Platform &bull; Feedback Receipt</p>
          </div>
          <div class="body">
            <div class="greeting">Hello ${name},</div>
            <div class="intro">
              Thank you for submitting your feedback and suggestions! Here is a complete copy of the information you provided for your review:
            </div>
            
            <table class="details-table">
              <tr>
                <td class="label">Contributor Name</td>
                <td class="value">${name}</td>
              </tr>
              <tr>
                <td class="label">Email Address</td>
                <td class="value">${email}</td>
              </tr>
              <tr>
                <td class="label">Phone Number</td>
                <td class="value">${phone || 'Not provided'}</td>
              </tr>
              <tr>
                <td class="label">Organisation</td>
                <td class="value">${organizationName || 'Not specified'}</td>
              </tr>
              <tr>
                <td class="label">Platform Role</td>
                <td class="value">${role ? role.toUpperCase() : 'GENERAL'}</td>
              </tr>
              <tr>
                <td class="label">Category</td>
                <td class="value">${category}</td>
              </tr>
              <tr>
                <td class="label">Rating</td>
                <td class="value"><span class="rating-badge">${stars}</span> (${rating}/5)</td>
              </tr>
              <tr>
                <td class="label">Submission Date</td>
                <td class="value">${submissionDate}</td>
              </tr>
            </table>

            <div style="font-size: 12px; color: #888888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Your Comments & Suggestions:
            </div>
            <div class="message-box">${message}</div>
          </div>
          <div class="footer">
            Food Rescue Platform &bull; Connecting Donors & Curators &bull; Automated notification email
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Food Rescue Platform" <no-reply@foodrescue.org>',
      to: email,
      subject: `Your Feedback Review - Food Rescue Platform [${category}]`,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('Ethereal preview URL for testing:', previewUrl);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null
    };
  } catch (error) {
    console.error('Error sending feedback confirmation email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendFeedbackConfirmation
};
