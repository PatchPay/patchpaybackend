const fs = require('fs');
const path = require('path');

// Function to ensure directories exist with correct case
function ensureDirectories() {
  const directories = [
    'controllers',
    'models',
    'middlewares',
    'services',
    'utils',
    'cron',
    'routes'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    } else {
      console.log(`Directory already exists: ${dirPath}`);
    }
  });
}

// Run the function
ensureDirectories();
console.log('Directory structure check completed.'); 