const cron = require('node-cron');
const { checkQuoteNotifications } = require('../controllers/rfqController');

// Run the notification check every hour
const startQuoteNotificationCron = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Running quote notification check...');
      await checkQuoteNotifications();
      console.log('Quote notification check completed');
    } catch (error) {
      console.error('Error in quote notification cron job:', error);
    }
  });
};

module.exports = startQuoteNotificationCron; 