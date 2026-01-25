// JonCoin models and backend API design proposal

// 1. Modeli kryesor: JonCoinTransaction
// - id
// - userId (merrës/shitës)
// - type: ['purchase', 'spend', 'reward', 'commission', 'withdrawal', 'refund']
// - amount
// - status: ['pending', 'completed', 'rejected']
// - relatedEntityType: ['ad', 'sponsorship', 'product', 'service', 'withdrawal', 'other']
// - relatedEntityId
// - description
// - createdAt, updatedAt

// 2. Fusha joncoin_balance në modelin User ose një tabelë JonCoinWallet
// - userId
// - balance

// 3. WithdrawalRequest
// - id
// - userId
// - amount
// - status: ['pending', 'completed', 'rejected']
// - createdAt, updatedAt

// 4. API endpoints (shembuj):
// POST   /api/joncoin/purchase         // Blerje JonCoin nga marketplace
// POST   /api/joncoin/spend            // Shpenzo JonCoin për shërbime/produkte
// POST   /api/joncoin/reward           // Reward automatik (p.sh. për postbaner)
// POST   /api/joncoin/withdraw         // Kërkesë për tërheqje
// GET    /api/joncoin/balance          // Merr balancën
// GET    /api/joncoin/transactions     // Historiku i transaksioneve
// PATCH  /api/joncoin/transaction/:id  // Konfirmo/refuzo transaksion (admin)

// 5. Komisionet llogariten automatikisht në backend për shitje dhe withdrawal

// 6. Çdo pagesë/shpenzim është fillimisht 'pending' dhe konfirmohet nga admin ose nga palët përkatëse

// 7. Çdo veprim log-het në JonCoinTransaction

// Kjo është struktura bazë për modelet dhe API-të. Hapi tjetër: krijimi i modeleve Sequelize dhe migrimeve.
