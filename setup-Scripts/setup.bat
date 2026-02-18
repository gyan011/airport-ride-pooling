@echo off
REM Airport Ride Pooling - Windows Setup Script

echo ========================================
echo Airport Ride Pooling Backend Setup
echo ========================================
echo.

REM Check Node.js
echo Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    exit /b 1
)
echo Node.js version: 
node -v
echo.

REM Check npm
echo Checking npm...
npm -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed
    exit /b 1
)
echo npm version:
npm -v
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo Dependencies installed successfully
echo.

REM Create .env file
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo .env file created
    echo.
    echo IMPORTANT: Edit .env file with your configuration
    echo.
) else (
    echo .env file already exists
    echo.
)

REM Create logs directory
if not exist logs mkdir logs
echo Logs directory ready
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Make sure MongoDB and Redis are running
echo.
echo 2. Seed the database:
echo    npm run seed
echo.
echo 3. Start the server:
echo    npm run dev
echo.
echo 4. Test the API:
echo    Open http://localhost:3000/health in your browser
echo.
echo 5. Import Postman collection from:
echo    docs/postman-collection.json
echo.
echo Documentation is available in:
echo - README.md
echo - QUICKSTART.md
echo - docs/API_DOCUMENTATION.md
echo - docs/SYSTEM_DESIGN.md
echo.
pause