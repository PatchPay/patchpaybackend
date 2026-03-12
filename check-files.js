const fs = require('fs');
const path = require('path');

// Function to check if files exist and create them if they don't
function checkFiles() {
  const files = [
    { dir: 'controllers', file: 'userController.js' },
    { dir: 'middlewares', file: 'validateuser.js' },
    { dir: 'models', file: 'User.js' },
    { dir: 'services', file: 'emailService.js' },
    { dir: 'middlewares', file: 'authMiddleware.js' }
  ];

  files.forEach(({ dir, file }) => {
    const filePath = path.join(__dirname, dir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      console.log(`Creating empty file: ${filePath}`);
      
      // Create the directory if it doesn't exist
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Create an empty file
      fs.writeFileSync(filePath, '// This file was created by the check-files.js script');
    } else {
      console.log(`File exists: ${filePath}`);
    }
  });
}

// Run the function
checkFiles();
console.log('File check completed.'); 