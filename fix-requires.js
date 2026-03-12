const fs = require('fs');
const path = require('path');

// Function to fix require statements in userRoutes.js
function fixRequires() {
  const userRoutesPath = path.join(__dirname, 'routes', 'userRoutes.js');
  
  if (!fs.existsSync(userRoutesPath)) {
    console.log(`File not found: ${userRoutesPath}`);
    return;
  }
  
  try {
    // Read the file
    let content = fs.readFileSync(userRoutesPath, 'utf8');
    
    // Replace require statements to handle case sensitivity
    content = content.replace(
      /require\(['"]\.\.\/controllers\/userController['"]\)/g,
      "require('../controllers/userController') || require('../Controllers/userController')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/middlewares\/validateuser['"]\)/g,
      "require('../middlewares/validateuser') || require('../Middlewares/validateuser')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/models\/User['"]\)/g,
      "require('../models/User') || require('../Models/User')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/services\/emailService['"]\)/g,
      "require('../services/emailService') || require('../Services/emailService')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/middlewares\/authMiddleware['"]\)/g,
      "require('../middlewares/authMiddleware') || require('../Middlewares/authMiddleware')"
    );
    
    // Write the modified content back to the file
    fs.writeFileSync(userRoutesPath, content);
    console.log(`Fixed require statements in: ${userRoutesPath}`);
  } catch (error) {
    console.error(`Error fixing require statements in: ${userRoutesPath}`, error);
  }
}

// Run the function
fixRequires();
console.log('Require statement fix completed.'); 