const axios = require('axios');
require('dotenv').config();

// Get your Squad API keys from environment variables
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;
const SQUAD_PUBLIC_KEY = process.env.SQUAD_PUBLIC_KEY;

async function testSquadAPI() {
  console.log('Testing Squad API connectivity...');
  console.log('Using Secret Key:', SQUAD_SECRET_KEY ? `${SQUAD_SECRET_KEY.substring(0, 10)}...` : 'NOT FOUND');
  console.log('Using Public Key:', SQUAD_PUBLIC_KEY ? `${SQUAD_PUBLIC_KEY.substring(0, 10)}...` : 'NOT FOUND');
  
  if (!SQUAD_SECRET_KEY) {
    console.error('❌ ERROR: SQUAD_SECRET_KEY is not defined in your .env file');
    return false;
  }
  
  try {
    // Try to fetch the merchant profile - a simple endpoint that requires authentication
    const response = await axios.get('https://sandbox-api-d.squadco.com/v1/merchant/profile', {
      headers: {
        'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ SUCCESS: Squad API is working!');
    console.log('Merchant details:', response.data);
    return true;
  } catch (error) {
    console.error('❌ ERROR: Squad API request failed');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else if (error.request) {
      console.error('No response received from Squad API');
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    return false;
  }
}

// Run the test
testSquadAPI().then(result => {
  if (!result) {
    console.log('Please check your API keys and try again.');
  }
}); 