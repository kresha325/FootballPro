# Stripe Payment Integration

## Setup

### 1. Create Stripe Account
- Go to https://dashboard.stripe.com/register
- Create a free account
- Complete verification

### 2. Get API Keys
- Go to https://dashboard.stripe.com/test/apikeys
- Copy:
  - **Publishable Key** (starts with `pk_test_`)
  - **Secret Key** (starts with `sk_test_`)

### 3. Configure Backend
Update `backend/.env`:
```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
FRONTEND_URL=http://192.168.100.57:5174
```

### 4. Configure Frontend
Update `frontend/.env`:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

### 5. Setup Webhook (For Production)
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/payments/webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook secret

## Testing

### Test Cards
Use these card numbers in Stripe Checkout:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Auth Required**: `4000 0025 0000 3155`

- **Expiry**: Any future date (e.g., `12/34`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

### Test Flow
1. Go to http://192.168.100.57:5174/marketplace
2. Click "Bli Tani" on any product
3. You'll be redirected to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
5. Complete the payment
6. You'll be redirected back with success message
7. Order is created and product stock is reduced

## Features Implemented

✅ **Stripe Checkout Session** - Secure hosted checkout page
✅ **Webhook Handler** - Handles payment events
✅ **Order Creation** - Automatic order creation on successful payment
✅ **Stock Management** - Reduces product stock after purchase
✅ **Payment History** - Track all payments
✅ **Success/Cancel Redirects** - User-friendly flow

## API Endpoints

### Create Checkout Session
```
POST /api/payments/create-checkout-session
Authorization: Bearer <token>
Body: {
  "productId": 1,
  "quantity": 1
}
Response: {
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Webhook (Stripe Only)
```
POST /api/payments/webhook
Headers: stripe-signature
Body: <raw Stripe event>
```

### Get Payments
```
GET /api/payments
Authorization: Bearer <token>
Response: [
  {
    "id": 1,
    "amount": 49.99,
    "currency": "eur",
    "status": "succeeded",
    ...
  }
]
```

## Security Notes

- ✅ Never expose Secret Key in frontend
- ✅ Always validate webhooks with signature
- ✅ Use HTTPS in production
- ✅ Store sensitive keys in environment variables
- ✅ Never commit `.env` file to git

## Production Checklist

- [ ] Replace test keys with live keys
- [ ] Setup webhook endpoint with HTTPS
- [ ] Verify webhook signature
- [ ] Setup email receipts
- [ ] Add invoice generation
- [ ] Implement refund functionality
- [ ] Add subscription support (if needed)
