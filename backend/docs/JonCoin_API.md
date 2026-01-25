# JonCoin API Endpoints

Të gjitha endpoint-et kërkojnë autentikim (JWT, middleware auth).

**GET /api/joncoin/balance**
- Përshkrimi: Merr balancën aktuale të JonCoin për userin e loguar.
- Response: `{ balance: 100.00 }`

**GET /api/joncoin/transactions**
- Përshkrimi: Merr historikun e transaksioneve të JonCoin për userin e loguar.
- Response: `[ { id, type, amount, status, ... } ]`

**POST /api/joncoin/purchase**
- Përshkrimi: Krijo kërkesë për blerje JonCoin (nga marketplace, status fillestar pending).
- Body: `{ amount }`

**POST /api/joncoin/spend**
- Përshkrimi: Krijo kërkesë për shpenzim JonCoin për shërbime/produkte (status pending).
- Body: `{ amount, relatedEntityType, relatedEntityId, description }`

**POST /api/joncoin/reward**
- Përshkrimi: Jep reward JonCoin (p.sh. për postbaner, admin/sistem).
- Body: `{ userId, amount, description, relatedEntityType, relatedEntityId }`

**POST /api/joncoin/withdraw**
- Përshkrimi: Kërkesë për tërheqje JonCoin (status pending, komision 5%).
- Body: `{ amount }`

**PATCH /api/joncoin/transaction/:id**
- Përshkrimi: Konfirmo/refuzo transaksion (admin).
- Body: `{ status: 'completed' | 'rejected' }`

**POST /api/joncoin/transfer**
- Përshkrimi: Transfero JonCoin te një user tjetër.
- Body: `{ toUserId, amount, description? }`

---

Për çdo endpoint, në rast suksesi kthehet `{ success: true, ... }` ose të dhënat përkatëse. Në rast gabimi, kthehet `{ error: '...' }`.

Për përdorim nga frontend/mobile, përdorni JWT token në Authorization header.
