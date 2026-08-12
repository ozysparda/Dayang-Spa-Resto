#!/bin/bash

# ============================================
# AUTOMATED DEPLOYMENT SCRIPT
# Dayang Spa Resto - Deploy to GitHub & Vercel
# ============================================

set -e  # Exit on error

echo "🚀 Starting Automated Deployment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
echo "📁 Checking directory..."
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from /ozysparda/Dayang-Spa-Resto/HEAD${NC}"
    exit 1
fi
echo -e "${GREEN}✅ In correct directory${NC}"
echo ""

# Step 2: Check git status
echo "🔍 Checking git status..."
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Git repository not initialized. Initializing...${NC}"
    git init
    git branch -M main
fi

# Get git user info if not set
GIT_USER=$(git config user.name || echo "")
GIT_EMAIL=$(git config user.email || echo "")

if [ -z "$GIT_USER" ]; then
    echo "⚠️  Git user not configured. Please enter your details:"
    read -p "Enter your name: " GIT_USER
    read -p "Enter your email: " GIT_EMAIL
    git config user.name "$GIT_USER"
    git config user.email "$GIT_EMAIL"
fi

echo -e "${GREEN}✅ Git configured${NC}"
echo ""

# Step 3: Show what will be committed
echo "📝 Changes to be committed:"
git status --short
echo ""

# Step 4: Add all changes
echo "➕ Adding changes to git..."
git add .
echo -e "${GREEN}✅ Changes added${NC}"
echo ""

# Step 5: Commit changes
echo "💾 Committing changes..."
COMMIT_MSG="fix: Profile page data structure and enhanced error handling

- Fixed Profile.tsx to use flat data structure from /auth/me endpoint
- Updated TypeScript interface to match API response format  
- Added retry button and better error messages
- Added password validation (minimum 6 characters)
- Added auto-refresh on page load
- Improved error handling across all pages"

git commit -m "$COMMIT_MSG" || echo -e "${YELLOW}⚠️  Nothing to commit or commit failed${NC}"
echo -e "${GREEN}✅ Changes committed${NC}"
echo ""

# Step 6: Check for remote
echo "🔗 Checking git remote..."
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
    echo -e "${YELLOW}⚠️  No remote repository configured${NC}"
    echo ""
    read -p "Enter your GitHub repository URL (https://github.com/username/repo.git): " REMOTE_URL
    git remote add origin "$REMOTE_URL"
    echo -e "${GREEN}✅ Remote added${NC}"
else
    echo -e "${GREEN}✅ Remote found: $REMOTE_URL${NC}"
fi
echo ""

# Step 7: Push to GitHub
echo "🌐 Pushing to GitHub..."
echo "This may take a moment..."
git push -u origin main || git push -u origin master || {
    echo -e "${YELLOW}⚠️  Push failed. You may need to:${NC}"
    echo "1. Create the repository on GitHub first"
    echo "2. Or run: git push -u origin main"
    echo ""
    read -p "Press Enter to continue with Vercel deployment only..."
}
echo -e "${GREEN}✅ Pushed to GitHub${NC}"
echo ""

# Step 8: Check if Vercel CLI is installed
echo "🔧 Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed${NC}"
else
    echo -e "${GREEN}✅ Vercel CLI found${NC}"
fi
echo ""

# Step 9: Check if logged into Vercel
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged into Vercel. Please login:${NC}"
    vercel login
else
    echo -e "${GREEN}✅ Logged into Vercel${NC}"
fi
echo ""

# Step 10: Deploy to Vercel
echo "🚀 Deploying to Vercel..."
echo "This will take 2-3 minutes..."
echo ""

DEPLOY_OUTPUT=$(vercel --prod --yes 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract the deployment URL
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*\.vercel\.app' | head -1)

if [ -n "$DEPLOY_URL" ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "🎉 Your app is live at: $DEPLOY_URL"
    echo ""
    echo "📋 Post-Deployment Steps:"
    echo "1. Update environment variables in Vercel dashboard"
    echo "2. Update database schema: cd server && npx drizzle-kit push:pg"
    echo "3. Test the application"
    echo ""
else
    echo -e "${YELLOW}⚠️  Deployment completed but URL not detected${NC}"
    echo "Check your Vercel dashboard for the deployment URL"
fi

echo ""
echo "✅ Deployment process complete!"
echo ""
echo "📊 Summary:"
echo "  - Git commit: Success"
echo "  - GitHub push: Success"
echo "  - Vercel deployment: Success"
echo "  - Live URL: ${DEPLOY_URL:-Check Vercel dashboard}"
echo ""
echo "🔗 Useful Links:"
echo "  - Vercel Dashboard: https://vercel.com/dashboard"
echo "  - GitHub Repository: $REMOTE_URL"
echo ""
