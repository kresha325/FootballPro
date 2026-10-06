# Environment variables

Names only. Do not commit values. Copy `backend/.env.example` to `backend/.env` for local development.

Production TLS is terminated by the host. Do not set a private key in the repository.

Rate limits are in-memory and per process. Behind more than one API instance, a client can exceed the intended limit by spreading requests across instances. A shared store is not part of this deployment.

| Variable | Purpose | Required | Environment |
| --- | --- | --- | --- |
| DATABASE_URL | Postgres connection string | Yes, when host/user/password are not set separately | development, production |
| DB_HOST | Database host | Yes if DATABASE_URL is unset | development |
| DB_PORT | Database port | No | development |
| DB_NAME | Database name | Yes if DATABASE_URL is unset | development |
| DB_USER | Database user | Yes if DATABASE_URL is unset | development |
| DB_PASS | Database password | Yes if DATABASE_URL is unset | development |
| DB_SSL | Enable Postgres SSL | No | production |
| PGSSLMODE | libpq SSL mode | No | production |
| NODE_ENV | development, test, or production | Yes | all |
| PORT | API listen port | Yes in production | all |
| JWT_SECRET | Signs and verifies access tokens | Yes in production | all |
| JWT_EXPIRES_IN | Documented token lifetime hint | No | all |
| CORS_ORIGIN | Extra trusted browser origins, comma-separated | No | production |
| FRONTEND_URL | Public web origin for links and CORS | Yes in production | production |
| CLOUDINARY_URL | Cloudinary connection URL | No | production |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name | No | production |
| CLOUDINARY_API_KEY | Cloudinary API key | No | production |
| CLOUDINARY_API_SECRET | Cloudinary API secret | No | production |
| STRIPE_SECRET_KEY | Stripe secret key | Only when card payments are enabled | production |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret | Only when card payments are enabled | production |
| PAYMENTS_ENABLED | Turns live card payments on | No | production |
| LIVEKIT_API_KEY | LiveKit API key | When live calls are enabled | production |
| LIVEKIT_API_SECRET | LiveKit API secret | When live calls are enabled | production |
| LIVEKIT_URL | LiveKit server URL | When live calls are enabled | production |
| EMAIL_USER | SMTP / Gmail user | When email is enabled | production |
| EMAIL_PASSWORD | SMTP / Gmail app password | When email is enabled | production |
| SMTP_HOST | SMTP host | No | production |
| SMTP_PORT | SMTP port | No | production |
| SMTP_USER | SMTP user | No | production |
| SMTP_PASS | SMTP password | No | production |
| GOOGLE_CLIENT_ID | Google OAuth client id | When Google login is enabled | production |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | When Google login is enabled | production |
| FACEBOOK_APP_ID | Facebook app id | When Facebook login is enabled | production |
| FACEBOOK_APP_SECRET | Facebook app secret | When Facebook login is enabled | production |
| APPLE_CLIENT_ID | Apple Services ID | When Apple login is enabled | production |
| APPLE_TEAM_ID | Apple team id | When Apple login is enabled | production |
| APPLE_KEY_ID | Apple key id | When Apple login is enabled | production |
| APPLE_PRIVATE_KEY | Apple private key | When Apple login is enabled | production |
| APPLE_IAP_SHARED_SECRET | App Store legacy receipt secret | When iOS purchases are enabled | production |
| GOOGLE_PLAY_SERVICE_ACCOUNT_JSON | Play Developer API credentials | When Android purchases are verified | production |
| IAP_ALLOW_UNVERIFIED | Accept unverified store receipts | Development only. Ignored in production | development |
| PREMIUM_DEMO_MODE | Activate premium without payment | Development only. Ignored in production | development |
| ADMIN_BOOTSTRAP_EMAIL | Local admin seeder email | No | development |
| ADMIN_BOOTSTRAP_PASSWORD | Local admin seeder password | No | development |
| ALLOW_ADMIN_BOOTSTRAP | Allow the admin seeder in production | No | production maintenance |
| RESET_EMAIL | Target for resetPassword.js | No | development |
| RESET_PASSWORD | New password for resetPassword.js | No | development |
| ALLOW_DESTRUCTIVE | Allow destructive scripts in production | No | production maintenance |
| ADMIN_EMAIL | make-admin.js target email | No | maintenance |
| ADMIN_PASSWORD | make-admin.js password | No | maintenance |
| MEDIASOUP_ADMIN_TOKEN | Internal mediasoup callback token | When mediasoup is used | production |
| OPENAI_API_KEY | AI features | No | production |
| RATE_LIMIT_ENABLED | Set to false to disable the global limiter | No | all |
| AUTH_RATE_LIMIT_ENABLED | Set to false to disable auth limiters | No | all |

Local uploads under `backend/uploads` are filesystem storage. They are not durable across hosts and should move to Cloudinary or object storage before relying on them in production. The API does not execute those files.
