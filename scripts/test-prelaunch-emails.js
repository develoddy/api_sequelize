#!/usr/bin/env node

/**
 * Script de prueba para emails de prelaunch
 * Uso: node test-prelaunch-emails.js
 */

import dotenv from 'dotenv';
import axios from 'axios';

// Cargar variables de entorno
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

const API_BASE_URL = process.env.URL_BACKEND || 'http://localhost:3000';

console.log('🧪 Testing Prelaunch Email System');
console.log('==================================');

async function testWelcomeEmail() {
    try {
        console.log('\n1️⃣ Testing Welcome Email...');
        
        const testEmail = 'test+welcome@lujandev.com';
        
        // Registrar email
        console.log(`📧 Registering email: ${testEmail}`);
        const response = await axios.post(`${API_BASE_URL}/api/prelaunch/subscribe`, {
            email: testEmail,
            source: 'main_form',
            session_id: 'test-session-welcome'
        });

        if (response.status === 200 || response.status === 201) {
            console.log('✅ Email registered successfully');
            console.log('📬 Welcome email should be sent automatically');
            console.log('📊 Response:', response.data);
        } else {
            console.log('❌ Registration failed:', response.status);
        }

    } catch (error) {
        console.error('❌ Error testing welcome email:', error.response?.data || error.message);
    }
}

async function testLaunchEmails() {
    try {
        console.log('\n2️⃣ Testing Launch Email Campaign...');
        
        const launchData = {
            coupon_discount: '20%',
            coupon_expiry_days: '5',
            launch_date: new Date().toLocaleDateString('es-ES'),
            featured_products: [
                {
                    name: 'Camiseta de Prueba',
                    price: '€19.95',
                    image: 'https://via.placeholder.com/300x300?text=Test+Shirt'
                }
            ]
        };

        console.log('📤 Sending launch email campaign...');
        console.log('⚠️  This will send emails to ALL subscribed users!');
        
        // Uncomment to actually send:
        /*
        const response = await axios.post(`${API_BASE_URL}/api/prelaunch/send-launch-emails`, launchData);
        
        if (response.status === 200) {
            console.log('✅ Launch emails sent successfully');
            console.log('📊 Results:', response.data);
        } else {
            console.log('❌ Launch emails failed:', response.status);
        }
        */
        
        console.log('⏭️  Skipped actual sending (uncomment to test)');
        console.log('📋 Would send with data:', JSON.stringify(launchData, null, 2));

    } catch (error) {
        console.error('❌ Error testing launch emails:', error.response?.data || error.message);
    }
}

async function testEmailStats() {
    try {
        console.log('\n3️⃣ Testing Email Statistics...');
        
        const response = await axios.get(`${API_BASE_URL}/api/prelaunch/stats`);
        
        if (response.status === 200) {
            console.log('✅ Stats retrieved successfully');
            console.log('📊 Statistics:', JSON.stringify(response.data, null, 2));
        } else {
            console.log('❌ Stats failed:', response.status);
        }

    } catch (error) {
        console.error('❌ Error getting stats:', error.response?.data || error.message);
    }
}

async function main() {
    console.log(`🔗 API Base URL: ${API_BASE_URL}`);
    console.log('📝 Make sure your backend server is running');
    console.log('📧 Configure SMTP settings in your .env file');
    
    await testWelcomeEmail();
    await testLaunchEmails();
    await testEmailStats();
    
    console.log('\n🏁 Testing completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Check your email inbox for welcome email');
    console.log('   2. Review server logs for any errors');
    console.log('   3. Test unsubscribe and verification links');
    console.log('   4. When ready, use launch-email-sender.js for production');
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});