/**
 * Generador de Secuencias de Onboarding para MailFlow
 * 
 * Este servicio genera automáticamente secuencias de emails de onboarding
 * basadas en el tipo de negocio y objetivo especificado.
 */

/**
 * Templates de secuencias por tipo de negocio y objetivo
 */
const sequenceTemplates = {
    ecommerce: {
        'first-purchase': {
            name: 'E-commerce First Purchase Sequence',
            emails: [
                {
                    order: 1,
                    delayHours: 0,
                    subject: 'Welcome to {brandName} - Get 10% Off Your First Order! 🎉',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Welcome to {brandName}!</h2>
                            <p>We're thrilled to have you join our community.</p>
                            <p>As a special welcome gift, here's <strong>10% off your first purchase</strong>!</p>
                            <p>Use code: <strong>WELCOME10</strong></p>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Start Shopping
                                </a>
                            </p>
                            <p>Happy shopping!<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Welcome to {brandName}! Get 10% off your first order with code WELCOME10.'
                },
                {
                    order: 2,
                    delayHours: 24,
                    subject: 'Still thinking it over? Your discount is waiting ⏰',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Your 10% discount is still available</h2>
                            <p>We noticed you haven't used your welcome discount yet.</p>
                            <p>Don't miss out on <strong>10% off your first order</strong>!</p>
                            <p>Here's what makes {brandName} special:</p>
                            <ul>
                                <li>✅ High-quality products</li>
                                <li>✅ Fast shipping</li>
                                <li>✅ 30-day returns</li>
                            </ul>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Browse Products
                                </a>
                            </p>
                            <p>Best,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Your 10% discount is still available! Use code WELCOME10 on your first order.'
                },
                {
                    order: 3,
                    delayHours: 72,
                    subject: 'Last chance: Your 10% discount expires soon! ⚡',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Don't let your discount expire!</h2>
                            <p>This is your final reminder - your <strong>10% welcome discount</strong> expires in 24 hours.</p>
                            <p>Use code: <strong>WELCOME10</strong></p>
                            <p>Shop now and discover why thousands of customers love {brandName}.</p>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Shop Now - Don't Miss Out!
                                </a>
                            </p>
                            <p>Thanks,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Last chance! Your 10% discount expires in 24 hours. Use code WELCOME10.'
                }
            ]
        },
        'engagement': {
            name: 'E-commerce Customer Engagement',
            emails: [
                {
                    order: 1,
                    delayHours: 0,
                    subject: 'Welcome to {brandName}! Here\'s what\'s new 🎉',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Welcome to {brandName}!</h2>
                            <p>Thanks for joining our community. Here's what you can expect:</p>
                            <ul>
                                <li>🎁 Exclusive member discounts</li>
                                <li>📦 Early access to new products</li>
                                <li>💡 Tips and recommendations</li>
                            </ul>
                            <p>Stay tuned for updates!</p>
                            <p>Best,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Welcome to {brandName}! Get exclusive discounts and early access to new products.'
                },
                {
                    order: 2,
                    delayHours: 48,
                    subject: 'Check out our bestsellers 🌟',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Our customers love these products</h2>
                            <p>Discover what's trending at {brandName}:</p>
                            <p>Browse our collection and find your next favorite.</p>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    View Bestsellers
                                </a>
                            </p>
                            <p>Cheers,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Check out our bestselling products at {brandName}.'
                }
            ]
        }
    },
    saas: {
        'trial-conversion': {
            name: 'SaaS Trial to Paid Conversion',
            emails: [
                {
                    order: 1,
                    delayHours: 0,
                    subject: 'Welcome to {brandName} - Let\'s get you started! 🚀',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Welcome to {brandName}!</h2>
                            <p>Your free trial is now active. Here's how to get the most out of it:</p>
                            <ol>
                                <li>Complete your profile setup</li>
                                <li>Explore the main features</li>
                                <li>Connect your first integration</li>
                            </ol>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Get Started
                                </a>
                            </p>
                            <p>Need help? Reply to this email anytime.</p>
                            <p>Best,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Welcome to {brandName}! Your trial is active. Get started now.'
                },
                {
                    order: 2,
                    delayHours: 24,
                    subject: 'Here are 3 powerful features you should try',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Maximize your trial with these features</h2>
                            <p>Here are the most popular features our users love:</p>
                            <ul>
                                <li><strong>Feature 1:</strong> Save time with automation</li>
                                <li><strong>Feature 2:</strong> Get insights with analytics</li>
                                <li><strong>Feature 3:</strong> Collaborate with your team</li>
                            </ul>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Explore Features
                                </a>
                            </p>
                            <p>Cheers,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Explore powerful features in {brandName}: automation, analytics, and collaboration.'
                },
                {
                    order: 3,
                    delayHours: 120,
                    subject: 'Your trial ends soon - Upgrade now and save 20%',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Don't lose access to your work</h2>
                            <p>Your trial ends in 2 days. Upgrade now and get <strong>20% off your first month</strong>.</p>
                            <p>What you'll keep access to:</p>
                            <ul>
                                <li>✅ All premium features</li>
                                <li>✅ Unlimited projects</li>
                                <li>✅ Priority support</li>
                            </ul>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Upgrade Now - Save 20%
                                </a>
                            </p>
                            <p>Thanks,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Your trial ends in 2 days. Upgrade now and save 20% on your first month.'
                }
            ]
        },
        'onboarding': {
            name: 'SaaS Product Onboarding',
            emails: [
                {
                    order: 1,
                    delayHours: 0,
                    subject: 'Welcome to {brandName} - Your quick start guide 🎯',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Welcome aboard!</h2>
                            <p>Let's get you up and running in 3 simple steps:</p>
                            <ol>
                                <li>Set up your account</li>
                                <li>Create your first project</li>
                                <li>Invite your team</li>
                            </ol>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Start Setup
                                </a>
                            </p>
                            <p>Best,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Welcome to {brandName}! Follow our quick start guide to get started.'
                },
                {
                    order: 2,
                    delayHours: 48,
                    subject: 'Pro tips for {brandName}',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Get more done with these tips</h2>
                            <p>Here are some pro tips from our power users:</p>
                            <ul>
                                <li>💡 Use keyboard shortcuts to work faster</li>
                                <li>📊 Set up custom dashboards</li>
                                <li>🔔 Configure notifications your way</li>
                            </ul>
                            <p>Want to learn more? Check out our help center.</p>
                            <p>Cheers,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Pro tips: Use shortcuts, custom dashboards, and smart notifications in {brandName}.'
                }
            ]
        }
    },
    services: {
        'engagement': {
            name: 'Service Business Engagement',
            emails: [
                {
                    order: 1,
                    delayHours: 0,
                    subject: 'Welcome to {brandName} - We\'re here to help! 👋',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Thanks for choosing {brandName}</h2>
                            <p>We're excited to work with you. Here's what happens next:</p>
                            <ol>
                                <li>We'll review your needs</li>
                                <li>Schedule a consultation</li>
                                <li>Create a custom plan for you</li>
                            </ol>
                            <p>Have questions? Just reply to this email.</p>
                            <p>Best regards,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Welcome to {brandName}! We\'re here to help you succeed.'
                },
                {
                    order: 2,
                    delayHours: 48,
                    subject: 'How can we help you achieve your goals?',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Let's talk about your goals</h2>
                            <p>We'd love to understand your needs better.</p>
                            <p>Schedule a free consultation and discover how {brandName} can help you:</p>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Schedule Consultation
                                </a>
                            </p>
                            <p>Looking forward to speaking with you!</p>
                            <p>Best,<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Schedule a free consultation with {brandName} to discuss your goals.'
                }
            ]
        }
    },
    education: {
        'onboarding': {
            name: 'Education Platform Onboarding',
            emails: [
                {
                    order: 1,
                    delayHours: 0,
                    subject: 'Welcome to {brandName} - Start learning today! 📚',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Welcome to {brandName}!</h2>
                            <p>Your learning journey starts now. Here's how to get started:</p>
                            <ol>
                                <li>Browse our course catalog</li>
                                <li>Enroll in your first course</li>
                                <li>Join our community</li>
                            </ol>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Browse Courses
                                </a>
                            </p>
                            <p>Happy learning!<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Welcome to {brandName}! Start your learning journey today.'
                },
                {
                    order: 2,
                    delayHours: 24,
                    subject: 'Recommended courses just for you',
                    bodyHtml: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Courses we think you'll love</h2>
                            <p>Based on your interests, here are some popular courses:</p>
                            <ul>
                                <li>Course 1: Beginner Friendly</li>
                                <li>Course 2: Intermediate Level</li>
                                <li>Course 3: Advanced Topics</li>
                            </ul>
                            <p style="margin-top: 30px;">
                                <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    View All Courses
                                </a>
                            </p>
                            <p>Keep learning!<br>The {brandName} Team</p>
                        </div>
                    `,
                    bodyText: 'Check out courses recommended for you at {brandName}.'
                }
            ]
        }
    }
};

/**
 * Genera una secuencia de onboarding basada en los parámetros
 */
export const generateSequence = (businessType, goal, brandName, emailTone = 'friendly') => {
    // Obtener template base
    const template = sequenceTemplates[businessType]?.[goal];
    
    if (!template) {
        // Fallback: secuencia genérica
        return generateGenericSequence(businessType, goal, brandName, emailTone);
    }

    // Personalizar los emails con el nombre de la marca
    const personalizedEmails = template.emails.map(email => ({
        ...email,
        subject: email.subject.replace(/{brandName}/g, brandName),
        bodyHtml: email.bodyHtml.replace(/{brandName}/g, brandName),
        bodyText: email.bodyText.replace(/{brandName}/g, brandName),
        editable: true
    }));

    return {
        name: template.name.replace('E-commerce', brandName).replace('SaaS', brandName),
        emails: personalizedEmails
    };
};

/**
 * Genera una secuencia genérica si no hay template específico
 */
const generateGenericSequence = (businessType, goal, brandName, emailTone) => {
    return {
        name: `${brandName} Onboarding Sequence`,
        emails: [
            {
                order: 1,
                delayHours: 0,
                subject: `Welcome to ${brandName}! 🎉`,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Welcome to ${brandName}!</h2>
                        <p>We're excited to have you with us.</p>
                        <p>Get ready to experience something great.</p>
                        <p>Best,<br>The ${brandName} Team</p>
                    </div>
                `,
                bodyText: `Welcome to ${brandName}! We're excited to have you with us.`,
                editable: true
            },
            {
                order: 2,
                delayHours: 24,
                subject: `Getting started with ${brandName}`,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Let's get you started</h2>
                        <p>Here's what you can do with ${brandName}:</p>
                        <ul>
                            <li>Explore our features</li>
                            <li>Connect with our community</li>
                            <li>Achieve your goals</li>
                        </ul>
                        <p>Cheers,<br>The ${brandName} Team</p>
                    </div>
                `,
                bodyText: `Get started with ${brandName} and explore our features.`,
                editable: true
            },
            {
                order: 3,
                delayHours: 72,
                subject: `Make the most of ${brandName}`,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>You're doing great!</h2>
                        <p>Keep exploring ${brandName} and let us know if you need any help.</p>
                        <p>We're here to support you.</p>
                        <p>Thanks,<br>The ${brandName} Team</p>
                    </div>
                `,
                bodyText: `Keep exploring ${brandName}. We're here to help!`,
                editable: true
            }
        ]
    };
};

export default {
    generateSequence
};
