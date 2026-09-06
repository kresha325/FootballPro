const nodemailer = require('nodemailer');
const { isEmailConfigured, buildParentConfirmUrl } = require('../config/email');

let transporter = null;

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 0);
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port || 587,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

// Email templates
const emailTemplates = {
  passwordReset: (firstName, resetUrl) => ({
    subject: '🔐 Reset your XTalenti password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Password reset</h1>
        <p>Hi ${firstName || 'there'},</p>
        <p>We received a request to reset your XTalenti password. Click the button below to choose a new password. This link expires in one hour.</p>
        <a href="${resetUrl}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Reset password
        </a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">If you did not request this, you can ignore this email.</p>
      </div>
    `
  }),

  welcome: (firstName) => ({
    subject: '🏆 Welcome to XTalenti!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to XTalenti, ${firstName}!</h1>
        <p>Thank you for joining our global football community.</p>
        <p>Start building your profile, connect with players, scouts, and clubs worldwide.</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Get Started
        </a>
      </div>
    `
  }),

  newFollower: (followerName, userId) => ({
    subject: `🔔 ${followerName} started following you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${followerName} is now following you on XTalenti</h2>
        <p>Check out their profile and connect!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/profile/${userId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Profile
        </a>
      </div>
    `
  }),

  newLike: (likerName, postId) => ({
    subject: `👍 ${likerName} liked your post`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${likerName} liked your post</h2>
        <p>Your content is getting noticed!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/feed?post=${postId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Post
        </a>
      </div>
    `
  }),

  newComment: (commenterName, comment, postId) => ({
    subject: `💬 ${commenterName} commented on your post`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${commenterName} commented:</h2>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">"${comment}"</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/feed?post=${postId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Comment
        </a>
      </div>
    `
  }),

  newMessage: (senderName, preview, conversationId) => ({
    subject: `📨 New message from ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New message from ${senderName}</h2>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${preview}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/messaging"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Reply Now
        </a>
      </div>
    `
  }),

  scoutingRecommendation: (scoutName, clubName) => ({
    subject: `🔍 ${scoutName} from ${clubName} is interested in you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been scouted!</h2>
        <p><strong>${scoutName}</strong> from <strong>${clubName}</strong> has shown interest in your profile.</p>
        <p>This could be your big opportunity!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/scouting"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Details
        </a>
      </div>
    `
  }),

  tournamentInvite: (tournamentName, tournamentId) => ({
    subject: `🏆 You're invited to ${tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Tournament Invitation</h2>
        <p>You've been invited to participate in <strong>${tournamentName}</strong></p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/tournaments"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Tournament
        </a>
      </div>
    `
  }),

  premiumExpiring: (firstName, daysLeft) => ({
    subject: `⏰ Your Premium expires in ${daysLeft} days`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Premium Subscription Expiring</h2>
        <p>Hi ${firstName},</p>
        <p>Your Premium subscription will expire in <strong>${daysLeft} days</strong>.</p>
        <p>Renew now to keep your premium features!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/premium"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Renew Premium
        </a>
      </div>
    `
  }),

  rosterRequest: (data) => ({
    subject: `🏆 New Roster Request from ${data.athleteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Roster Request</h2>
        <p>Hi ${data.clubName},</p>
        <p><strong>${data.athleteName}</strong> wants to join your roster as <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">Message: "${data.message}"</p>` : ''}
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/roster/requests"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Review Request
        </a>
      </div>
    `
  }),

  rosterApproved: (data) => ({
    subject: `🎉 Roster Request Approved by ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Congratulations!</h2>
        <p>Hi ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> has approved your roster request as <strong>${data.position}</strong>!</p>
        ${data.message ? `<p style="background: #dcfce7; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/roster/my-requests"
           style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Details
        </a>
      </div>
    `
  }),
  parentVerification: (athleteName, token) => {
    const confirmUrl = buildParentConfirmUrl(token);
    return {
      subject: `XTalenti — konfirmim prindi për ${athleteName}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="color: #0f766e;">Konfirmim prindi / kujdestari</h2>
        <p>Përshëndetje,</p>
        <p><strong>${athleteName}</strong> është regjistruar në <strong>XTalenti</strong> (platformë për futboll: profil, video, turne).</p>
        <p>Për llogari të të miturve nën 18 vjeç, nevojitet miratimi juaj si prind ose kujdestar ligjor.</p>
        <p>Kliko butonin më poshtë për të konfirmuar (linku vlen <strong>7 ditë</strong>):</p>
        <a href="${confirmUrl}"
           style="background: #0f766e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold;">
          Konfirmo si prind
        </a>
        <p style="color:#6b7280; font-size:13px;">Nëse butoni nuk funksionon, kopjo këtë link në shfletues:</p>
        <p style="word-break: break-all; font-size:12px; color:#475569;">${confirmUrl}</p>
        <p style="margin-top:20px; color:#9ca3af; font-size:12px;">Nëse nuk e prisje këtë email, injoroje — asgjë nuk ndryshohet.</p>
        <p style="color:#9ca3af; font-size:12px;">— Ekipi XTalenti</p>
      </div>
    `,
    };
  },

  rosterRejected: (data) => ({
    subject: `Roster Request Update from ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Roster Request Update</h2>
        <p>Hi ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> has reviewed your roster request for <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <p>Keep improving and try again later!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/search?role=club"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Find Other Clubs
        </a>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, templateName, ...params) => {
  if (!isEmailConfigured()) {
    console.warn('📧 Email skipped — EMAIL_USER / EMAIL_PASSWORD not set on server');
    return { success: false, error: 'EMAIL_NOT_CONFIGURED', skipped: true };
  }

  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: 'EMAIL_TRANSPORT_UNAVAILABLE' };
  }

  try {
    const template = emailTemplates[templateName](...params);

    const mailOptions = {
      from: `"XTalenti" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html,
    };

    const info = await transport.sendMail(mailOptions);
    console.log('✅ Email sent:', templateName, '→', to, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email error:', templateName, '→', to, error.message);
    return { success: false, error: error.message };
  }
};

// Batch email sending
const sendBulkEmails = async (recipients, templateName, ...params) => {
  const results = await Promise.allSettled(
    recipients.map(email => sendEmail(email, templateName, ...params))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`📧 Bulk email: ${successful} sent, ${failed} failed`);
  return { successful, failed };
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  emailTemplates
};
