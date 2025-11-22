import { PrelaunchSubscriber } from '../src/models/PrelaunchSubscriber.js';
import { sequelize } from '../src/database/database.js';

(async () => {
  try {
    await sequelize.authenticate();
    console.log('🔌 Conectado a la base de datos');
    
    // Resetear todos los usuarios para pruebas
    const result = await PrelaunchSubscriber.update(
      { 
        notified_launch: false,
        coupon_sent: false 
      },
      { 
        where: { 
          email_verified: true,
          status: 'subscribed'
        } 
      }
    );
    
    console.log('✅ Usuarios reseteados:', result[0], 'registro(s) actualizado(s)');
    console.log('📧 Ahora puedes enviar la campaña de prueba nuevamente desde el admin');
    
    // Mostrar usuarios disponibles
    const available = await PrelaunchSubscriber.findAll({
      where: {
        email_verified: true,
        status: 'subscribed',
        notified_launch: false
      },
      attributes: ['id', 'email', 'createdAt']
    });
    
    console.log('\n📋 Usuarios disponibles para campaña:');
    available.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
