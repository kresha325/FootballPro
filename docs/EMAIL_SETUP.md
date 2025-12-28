# Email Notifications Setup

## Prerequisites
- Gmail account (or any SMTP provider)
- App Password generated (for Gmail)

## Gmail Setup

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "FootballPro Backend"
   - Copy the 16-character password

3. **Update .env file**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   FRONTEND_URL=http://192.168.100.57:5174
   ```

## Email Templates Available

- ✅ **Welcome Email** - Sent on registration
- ✅ **New Follower** - When someone follows you
- ✅ **New Like** - When someone likes your post
- ✅ **New Comment** - When someone comments on your post
- ✅ **New Message** - When you receive a direct message
- ✅ **Scouting Recommendation** - When a scout shows interest
- ✅ **Tournament Invite** - When invited to a tournament
- ✅ **Premium Expiring** - 7 days before premium expires

## Testing

1. Register a new user
2. Check your email for welcome message
3. Test other notifications by:
   - Following someone
   - Liking a post
   - Commenting
   - Sending a message

## Note
Email notifications are non-blocking. If email sending fails, the main action (register, follow, like, etc.) will still succeed.

## Alternative SMTP Providers

If not using Gmail, update `backend/services/emailService.js`:

```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```
