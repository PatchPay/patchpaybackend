const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to create symbolic links
function createSymlinks() {
  const links = [
    { 
      source: path.join(__dirname, 'controllers', 'userController.js'),
      link: path.join(__dirname, 'Controllers', 'userController.js')
    },
    { 
      source: path.join(__dirname, 'middlewares', 'validateuser.js'),
      link: path.join(__dirname, 'Middlewares', 'validateuser.js')
    },
    { 
      source: path.join(__dirname, 'models', 'User.js'),
      link: path.join(__dirname, 'Models', 'User.js')
    },
    { 
      source: path.join(__dirname, 'services', 'emailService.js'),
      link: path.join(__dirname, 'Services', 'emailService.js')
    },
    { 
      source: path.join(__dirname, 'middlewares', 'authMiddleware.js'),
      link: path.join(__dirname, 'Middlewares', 'authMiddleware.js')
    }
  ];

  links.forEach(({ source, link }) => {
    try {
      if (fs.existsSync(source)) {
        // Create the link directory if it doesn't exist
        const linkDir = path.dirname(link);
        if (!fs.existsSync(linkDir)) {
          fs.mkdirSync(linkDir, { recursive: true });
        }
        
        // Create the symbolic link
        // Note: This will only work on Unix-like systems (Linux, macOS)
        // On Windows, you need to run as administrator and use a different approach
        try {
          execSync(`ln -sf "${source}" "${link}"`);
          console.log(`Symbolic link created: ${source} -> ${link}`);
        } catch (error) {
          console.error(`Error creating symbolic link: ${source} -> ${link}`, error);
          console.log('This might be because you are on Windows or not running as administrator.');
          console.log('Trying alternative approach...');
          
          // Alternative approach: Copy the file instead
          fs.copyFileSync(source, link);
          console.log(`File copied instead: ${source} -> ${link}`);
        }
      } else {
        console.log(`Source file not found: ${source}`);
      }
    } catch (error) {
      console.error(`Error processing file: ${source} -> ${link}`, error);
    }
  });
}

// Run the function
createSymlinks();
console.log('Symbolic link creation completed.'); 