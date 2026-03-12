const fs = require('fs');
const path = require('path');

// Function to copy files from source to destination
function copyFiles() {
  const files = [
    { 
      source: path.join(__dirname, 'controllers', 'userController.js'),
      destination: path.join(__dirname, 'controllers', 'userController.js')
    },
    { 
      source: path.join(__dirname, 'middlewares', 'validateuser.js'),
      destination: path.join(__dirname, 'middlewares', 'validateuser.js')
    },
    { 
      source: path.join(__dirname, 'models', 'User.js'),
      destination: path.join(__dirname, 'models', 'User.js')
    },
    { 
      source: path.join(__dirname, 'services', 'emailService.js'),
      destination: path.join(__dirname, 'services', 'emailService.js')
    },
    { 
      source: path.join(__dirname, 'middlewares', 'authMiddleware.js'),
      destination: path.join(__dirname, 'middlewares', 'authMiddleware.js')
    }
  ];

  files.forEach(({ source, destination }) => {
    try {
      if (fs.existsSync(source)) {
        // Create the destination directory if it doesn't exist
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy the file
        fs.copyFileSync(source, destination);
        console.log(`File copied: ${source} -> ${destination}`);
      } else {
        console.log(`Source file not found: ${source}`);
      }
    } catch (error) {
      console.error(`Error copying file: ${source} -> ${destination}`, error);
    }
  });
}

// Run the function
copyFiles();
console.log('File copy completed.'); 