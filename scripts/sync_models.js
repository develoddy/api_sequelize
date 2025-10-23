import { sequelize } from '../src/database/database.js';
import '../src/models/chat/ChatConversation.js';
import '../src/models/chat/ChatMessage.js';

(async () => {
  try {
    console.log('Starting sequelize.sync()...');
    await sequelize.sync({ alter: true });
    console.log('Sequelize sync completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during sequelize.sync():', err);
    process.exit(1);
  }
})();
