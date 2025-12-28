const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

// Email templates
const emailTemplates = {
  welcome: (firstName) => ({
    subject: '🏆 Welcome to FootballPro!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to FootballPro, ${firstName}!</h1>
        <p>Thank you for joining our global football community.</p>
        <p>Start building your profile, connect with players, scouts, and clubs worldwide.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}" 
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
        <h2>${followerName} is now following you on FootballPro</h2>
        <p>Check out their profile and connect!</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/profile/${userId}" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/feed?post=${postId}" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/feed?post=${postId}" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/messaging" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/scouting" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/tournaments" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/premium" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/roster/requests" 
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
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/roster/my-requests" 
           style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Details
        </a>
      </div>
    `
  }),

  rosterRejected: (data) => ({
    subject: `Roster Request Update from ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Roster Request Update</h2>
        <p>Hi ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> has reviewed your roster request for <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <p>Keep improving and try again later!</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/search?role=club" 
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Find Other Clubs
        </a>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, templateName, ...params) => {
  try {
    const template = emailTemplates[templateName](...params);
    
    const mailOptions = {
      from: `"FootballPro" <${process.env.EMAIL_USER || 'noreply@footballpro.com'}>`,
      to,
      subject: template.subject,
      html: template.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email error:', error);
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
