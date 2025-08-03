const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Voice Assistant Servers...\n');

// Start backend server (Python)
console.log('📡 Starting Backend Server (Port 3001)...');
const backend = spawn('python', ['main.py'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

// Wait a moment for backend to start
setTimeout(() => {
  console.log('\n🌐 Starting Frontend Server (Port 3000)...');
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
    process.exit(0);
  });

  frontend.on('close', (code) => {
    console.log(`\n🌐 Frontend server exited with code ${code}`);
    backend.kill('SIGINT');
  });
}, 2000);

backend.on('close', (code) => {
  console.log(`\n📡 Backend server exited with code ${code}`);
});

console.log('\n✅ Servers starting...');
console.log('📱 Frontend will be available at: http://localhost:3000');
console.log('🔗 Backend will be available at: http://localhost:3001');
console.log('🎤 Voice Assistant will be ready when both servers are running');
console.log('\n💡 Press Ctrl+C to stop all servers\n'); 