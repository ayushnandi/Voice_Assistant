@echo off
echo 🚀 Setting up Voice Assistant...

echo.
echo 📦 Installing frontend dependencies...
call npm install

echo.
echo 📦 Installing backend dependencies...
cd server
call npm install
cd ..

echo.
echo 🔧 Creating environment file...
if not exist "server\.env" (
    echo PORT=3001 > server\.env
    echo NODE_ENV=development >> server\.env
    echo GEMINI_API_KEY=your_gemini_api_key_here >> server\.env
    echo ✅ Created server\.env file
    echo ⚠️  Please update server\.env with your actual Gemini API key
) else (
    echo ✅ server\.env already exists
)

echo.
echo 🎯 Setup complete! To start the application:
echo.
echo Option 1 - Start both servers together:
echo   npm run start
echo.
echo Option 2 - Start servers separately:
echo   Terminal 1: npm run start:backend
echo   Terminal 2: npm run start:frontend
echo.
echo 🌐 Frontend will be available at: http://localhost:3000
echo 🔗 Backend will be available at: http://localhost:3001
echo.
pause 