#!/bin/bash
# 🚀 One-command deployment script for FootballPro

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  FootballPro Complete Deployment Script (v1.0)          ║"
echo "║  This will deploy backend, frontend, and mobile app    ║"
echo "╚══════════════════════════════════════════════════════════╝"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/server.js" ]; then
    echo -e "${RED}❌ Error: Must run from FootballPro root directory${NC}"
    exit 1
fi

# Get deployment target
echo -e "${BLUE}Select deployment target:${NC}"
echo "1) Development (local testing)"
echo "2) Staging (staging environment)"
echo "3) Production (live servers)"
read -p "Enter choice (1-3): " deploy_target

case $deploy_target in
    1)
        ENVIRONMENT="development"
        BACKEND_PORT=5098
        FRONTEND_URL="http://localhost:5174"
        echo -e "${YELLOW}🔧 Mode: Development (Local)${NC}"
        ;;
    2)
        ENVIRONMENT="staging"
        BACKEND_PORT=5098
        FRONTEND_URL="https://staging.footballpro.com"
        echo -e "${YELLOW}🔧 Mode: Staging${NC}"
        ;;
    3)
        ENVIRONMENT="production"
        BACKEND_PORT=443
        FRONTEND_URL="https://footballpro.com"
        echo -e "${YELLOW}🚨 Mode: PRODUCTION - Extreme caution!${NC}"
        read -p "Are you absolutely sure? Type 'YES' to continue: " confirm
        if [ "$confirm" != "YES" ]; then
            echo "Deployment cancelled."
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# PHASE 1: Backend Deployment
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 1: Backend Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

cd backend
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
npm install --production

echo -e "${YELLOW}🔄 Running database migrations...${NC}"
npm run migrate || echo -e "${YELLOW}⚠️  Migrations may have already been applied${NC}"

if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}🏗️  Building backend for production...${NC}"
    npm run build || echo -e "${YELLOW}⚠️  No build script defined${NC}"
fi

echo -e "${GREEN}✅ Backend prepared (ready to start with: npm run dev)${NC}"
cd ..

# PHASE 2: Frontend Deployment
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 2: Frontend Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

cd frontend
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
npm install --production

if [ "$ENVIRONMENT" != "development" ]; then
    echo -e "${YELLOW}🏗️  Building frontend for production...${NC}"
    npm run build
    
    if [ "$ENVIRONMENT" == "staging" ]; then
        echo -e "${YELLOW}📤 Deploying to Staging...${NC}"
        # vercel deploy --prod=false  # Uncomment if using Vercel
        echo -e "${GREEN}✅ Staging deployment ready (manual: vercel deploy)${NC}"
    fi
    
    if [ "$ENVIRONMENT" == "production" ]; then
        echo -e "${YELLOW}📤 Deploying to Production...${NC}"
        # vercel deploy --prod  # Uncomment if using Vercel
        echo -e "${GREEN}✅ Production deployment ready (manual: vercel deploy --prod)${NC}"
    fi
else
    echo -e "${GREEN}✅ Frontend ready for development (use: npm run dev)${NC}"
fi
cd ..

# PHASE 3: Mobile Deployment
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 3: Mobile App Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

cd mobile
echo -e "${YELLOW}📦 Installing mobile dependencies...${NC}"
npm install --legacy-peer-deps --production

if [ "$ENVIRONMENT" != "development" ]; then
    echo -e "${YELLOW}🔧 Updating version for production release...${NC}"
    # Increment version in app.json (manual)
    echo -e "${YELLOW}⚠️  Remember to increment buildNumber in app.json${NC}"
    
    echo -e "${YELLOW}🏗️  Building production mobile app...${NC}"
    npm run eas-build
    echo -e "${GREEN}✅ Mobile app building on EAS (monitor at expo.dev)${NC}"
else
    echo -e "${GREEN}✅ Mobile ready for development (use: npm start)${NC}"
fi
cd ..

# FINAL SUMMARY
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DEPLOYMENT PHASE COMPLETE!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo ""

if [ "$ENVIRONMENT" == "development" ]; then
    echo "1. Start Backend:"
    echo "   cd backend && npm run dev"
    echo ""
    echo "2. Start Frontend (in new terminal):"
    echo "   cd frontend && npm run dev"
    echo ""
    echo "3. Start Mobile (in new terminal):"
    echo "   cd mobile && npm start"
    echo ""
fi

if [ "$ENVIRONMENT" == "staging" ]; then
    echo "1. Verify staging backend is running"
    echo "2. Monitor staging frontend deployment"
    echo "3. Test mobile app on staging"
    echo "4. Run full QA suite"
    echo ""
fi

if [ "$ENVIRONMENT" == "production" ]; then
    echo "1. ⚠️  Monitor backend logs for errors"
    echo "2. ⚠️  Check frontend metrics on Vercel"
    echo "3. ⚠️  Track mobile app crash reports"
    echo "4. ⚠️  Have rollback plan ready"
    echo ""
fi

echo -e "${GREEN}🎉 Deployment configuration complete!${NC}"
echo ""
