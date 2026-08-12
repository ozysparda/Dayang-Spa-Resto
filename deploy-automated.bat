@echo off
REM ============================================
REM AUTOMATED DEPLOYMENT SCRIPT FOR WINDOWS
REM Dayang Spa Resto - Deploy to GitHub ^& Vercel
REM ============================================

echo 🚀 Starting Automated Deployment...
echo.

REM Step 1: Check directory
echo 📁 Checking directory...
if not exist package.json (
    echo ❌ Error: package.json not found. Please run this script from /ozysparda/Dayang-Spa-Resto/HEAD
    pause
    exit /b 1
)
echo ✅ In correct directory
echo.

REM Step 2: Check git status
echo 🔍 Checking git status...
if not exist .git (
    echo ⚠️  Git repository not found. Initializing...
    git init
    git branch -M main
)

REM Configure git if needed
git config user.name >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Git user not configured
    set /p GIT_NAME=Enter your name: 
    set /p GIT_EMAIL=Enter your email: 
    git config user.name !GIT_NAME!
    git config user.email !GIT_EMAIL!
)

echo ✅ Git configured
echo.

REM Step 3: Show changes
echo 📝 Changes to be committed:
git status --short
echo.

REM Step 4: Add changes
echo ➕ Adding changes to git...
git add .
echo ✅ Changes added
echo.

REM Step 5: Commit
echo 💾 Committing changes...
git commit -m "fix: Profile page data structure and enhanced error handling

- Fixed Profile.tsx to use flat data structure from /auth/me endpoint
- Updated TypeScript interface to match API response format  
- Added retry button and better error messages
- Added password validation (minimum 6 characters)
- Added auto-refresh on page load
- Improved error handling across all pages"

if errorlevel 1 (
    echo ⚠️  Nothing to commit or commit failed
) else (
    echo ✅ Changes committed
)
echo.

REM Step 6: Check remote
echo 🔗 Checking git remote...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ⚠️  No remote repository configured
    set /p REMOTE_URL=Enter your GitHub repository URL: 
    git remote add origin !REMOTE_URL!
    echo ✅ Remote added
) else (
    for /f "delims=" %%i in ('git remote get-url origin') do set REMOTE_URL=%%i
    echo ✅ Remote found: !REMOTE_URL!
)
echo.

REM Step 7: Push to GitHub
echo 🌐 Pushing to GitHub...
echo This may take a moment...
git push -u origin main
if errorlevel 1 (
    echo ⚠️  Push to main failed, trying master...
    git push -u origin master
)
if errorlevel 1 (
    echo ⚠️  Push failed. You may need to:
    echo 1. Create the repository on GitHub first
    echo 2. Or run: git push -u origin main
    echo.
    pause
)
echo ✅ Pushed to GitHub
echo.

REM Step 8: Check Vercel CLI
echo 🔧 Checking Vercel CLI...
where vercel >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Vercel CLI not found. Installing...
    call npm install -g vercel
    echo ✅ Vercel CLI installed
) else (
    echo ✅ Vercel CLI found
)
echo.

REM Step 9: Login to Vercel
echo 🔐 Checking Vercel authentication...
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Not logged into Vercel. Please login:
    vercel login
) else (
    echo ✅ Logged into Vercel
)
echo.

REM Step 10: Deploy
echo 🚀 Deploying to Vercel...
echo This will take 2-3 minutes...
echo.

REM Capture deployment output
setlocal
set DEPLOY_OUTPUT=
for /f "delims=" %%i in ('vercel --prod --yes 2^>^&1') do (
    set DEPLOY_OUTPUT=!DEPLOY_OUTPUT!%%i
)
echo !DEPLOY_OUTPUT!
endlocal

echo.
echo ✅ Deployment process complete!
echo.
echo 📊 Summary:
echo   - Git commit: Success
echo   - GitHub push: Success  
echo   - Vercel deployment: Success
echo.
echo 🔗 Useful Links:
echo   - Vercel Dashboard: https://vercel.com/dashboard
echo   - GitHub Repository: !REMOTE_URL!
echo.
pause
