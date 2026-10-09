import express from "express";
import productsRoutes from '../domains/commerce/catalog/routes/products.routes.js';
import usersRoutes from '../domains/identity/users/routes/users.routes.js';
import guestsRoutes from '../domains/commerce/guests/routes/guests.routes.js';
import categoriesRoutes from "../domains/commerce/catalog/routes/categories.routes.js";
import slidersRoutes from "../domains/commerce/sliders/routes/sliders.routes.js";
import cuponesRoutes from "../domains/commerce/promotions/routes/cupone.routes.js";
import discountsRoutes from "../domains/commerce/promotions/routes/discount.routes.js";
import homeRoutes from "../domains/commerce/storefront/routes/home.routes.js";
import cartsRoutes from "../domains/commerce/cart/routes/carts.routes.js";
import cartsCacheRoutes from "../domains/commerce/cart/routes/cartsCache.routes.js"; // Guest
import addressClient from "../domains/commerce/addresses/routes/addressClient.routes.js";
import addressGuest from "../domains/commerce/addresses/routes/addressGuest.routes.js"; // Guest
import sale from "../domains/commerce/orders/routes/sale.routes.js";
import shipping from "../domains/commerce/shipping/routes/shipping.routes.js";
import review from "../domains/commerce/reviews/routes/review.routes.js";
import productsPrintfulRoutes from "../domains/commerce/integrations/printful/routes/productsPrintful.routes.js";
import productsGelatoRoutes from "../domains/commerce/integrations/gelato/routes/productsGelato.routes.js";
import productsDropiRoutes from "../domains/commerce/integrations/dropi/routes/productsDropi.routes.js";
import wishlistRoutes from "../domains/commerce/wishlist/routes/wishlist.routes.js";
import shippingratesRoutes from "../domains/commerce/shipping/routes/shippingrates.route.js";
import stripeRoutes from "./stripe.routes.js";
import paypalRoutes from "../domains/commerce/payments/routes/paypal.routes.js";
import chatRoutes from '../domains/chat/routes/chat.routes.js';
import chatTenantRoutes from '../domains/chat/routes/chat-tenant.routes.js'; // 🚀 Multi-Tenant Chat SaaS
import saleRoutes  from '../domains/commerce/orders/routes/sale.routes.js';
import ReturnRoutes from '../domains/commerce/returns/routes/returns.routes.js';
import Inbox from '../domains/inbox/routes/inbox.routes.js';
import receiptRoutes from '../domains/commerce/receipts/routes/receipt.routes.js';
// Webhook de Printful
import printfulWebhook from '../domains/commerce/integrations/printful/routes/printfulWebhook.routes.js';
import notifications from '../domains/notifications/routes/notifications.routes.js';
import prelaunchRoutes from '../domains/prelaunch/routes/prelaunch.routes.js';
import newsletterRoutes from '../domains/newsletter/routes/newsletter.routes.js';
import postalCodeRoutes from '../domains/commerce/shipping/routes/postalCode.routes.js';
import analyticsRoutes from '../domains/commerce/analytics/routes/analytics.routes.js';
import trackingRoutes from '../domains/commerce/tracking/routes/tracking.routes.js';
import trackingEventsRoutes from '../domains/analytics/tracking/routes/trackingEvents.routes.js'; // 📊 Tracking de eventos del funnel
import backupsRoutes from '../domains/platform/backups/routes/backups.routes.js';
import databaseManagementRoutes from '../domains/platform/database-management/routes/database-management.routes.js';
import seoRoutes from '../domains/platform/seo/routes/seo.routes.js'; // ✅ SEO Management (Sitemap & Robots.txt)
import emailTestingRoutes from './emailTesting.routes.js'; // 🧪 Email Testing
import modulesRoutes from '../domains/platform/modules/modules.routes.js'; // 🚀 Multi-Module System (Levels-style)
import saasRoutes from '../domains/platform/tenants/saas.routes.js'; // 🚀 SaaS Tenants & Trials
import tenantsAdminRoutes from '../domains/platform/tenants/admin/tenants-admin.routes.js'; // 🔧 Platform Tenants Admin
import saasEmailTestingRoutes from '../domains/platform/tenants/saas-email-testing.routes.js'; // 🧪 SaaS Email Testing
import trackingAdminRoutes from '../domains/analytics/tracking/admin/tracking-admin.routes.js'; // 📊 Analytics Tracking Admin
import saasAdminRoutes from '../domains/analytics/mvp/routes/saas-admin.routes.js'; // 🔧 SaaS Admin Management
import healthRoutes from '../domains/platform/health/routes/health.routes.js'; // 🏥 Health Check
import mailflowRoutes from '../domains/mailflow/routes/mailflow.routes.js'; // 📧 MailFlow - Onboarding Sequences
import modulePreviewRoutes from './modulePreview.routes.js'; // 🎯 Generic Preview Mode for any SaaS module
import videoExpressRoutes from './videoExpress.routes.js'; // 🎬 Product Video Express - AI Video Generation
import videoExpressPreviewRoutes from './videoExpressPreview.routes.js'; // 🎬 Video Express Preview (Public)
import mvpHubRoutes from './mvpHub.routes.js'; // 🏠 MVP Hub - Dynamic listing of available MVPs
import mvpAnalyticsRoutes from '../domains/analytics/mvp/routes/mvpAnalytics.routes.js'; // 📊 MVP Analytics - Dynamic analytics from tracking_events
import financeRoutes from '../domains/finance/routes/finance.routes.js'; // 💰 Finance Module - Personal financial management
import inboxZeroPreventionRoutes from '../domains/platform/inbox-zero/routes/inboxZeroPrevention.routes.js'; // 📬 Inbox Zero Prevention - Public setup requests

const app = express();

app.use("/users", usersRoutes);
app.use("/guests", guestsRoutes);
app.use("/products", productsRoutes);
app.use("/categories", categoriesRoutes);
app.use("/sliders", slidersRoutes);
app.use("/cupones", cuponesRoutes);
app.use("/discounts", discountsRoutes);
app.use("/home", homeRoutes);
app.use("/cart", cartsRoutes);
app.use("/cartCache", cartsCacheRoutes);
app.use("/address_client", addressClient);
app.use("/address_guest", addressGuest);
app.use("/sale", sale);
app.use("/shipping", shipping);
app.use("/review", review);
app.use("/printful", productsPrintfulRoutes);
app.use("/gelato", productsGelatoRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/shipping", shippingratesRoutes);
app.use("/stripe", stripeRoutes);
app.use("/paypal", paypalRoutes);
app.use("/chat", chatRoutes);
app.use("/chat/tenant", chatTenantRoutes); // 🚀 Multi-Tenant Chat SaaS endpoints
app.use("/sales", saleRoutes);
app.use("/returns", ReturnRoutes);
app.use("/inbox", Inbox);
app.use("/receipts", receiptRoutes);
// Webhook de Printful
app.use("/printful-webhook", printfulWebhook);
app.use("/notifications", notifications);
app.use("/prelaunch", prelaunchRoutes);
app.use("/newsletter", newsletterRoutes);
app.use("/postal-codes", postalCodeRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/orders/tracking", trackingRoutes); // ✅ Ruta pública tracking
app.use("/tracking", trackingEventsRoutes); // 📊 Tracking de eventos del funnel (POST /tracking/events)
app.use("/backups", backupsRoutes); // ✅ Gestión de backups MySQL
app.use("/database-management", databaseManagementRoutes); // 🚨 Gestión de base de datos (SUPER_ADMIN)
app.use("/", seoRoutes); // ✅ SEO Management (sitemap.xml, robots.txt)
app.use("/email-testing", emailTestingRoutes); // 🧪 Email Testing (NO afecta Printful)
app.use("/", modulesRoutes); // 🚀 Multi-Module System (Levels-style)
app.use("/", saasRoutes); // 🚀 SaaS Tenants & Trials
app.use("/tenants", saasEmailTestingRoutes); // 🧪 Tenants list for testing
app.use("/saas-email-testing", saasEmailTestingRoutes); // 🧪 SaaS Email Testing
app.use("/admin/saas/tenants", tenantsAdminRoutes); // 🔧 Platform Tenants Admin (NUEVO - mount específico)
app.use("/admin/saas/tracking-events", trackingAdminRoutes); // 📊 Analytics Tracking Admin (NUEVO - mount específico)
app.use("/admin/saas", saasAdminRoutes); // 🔧 SaaS Admin Management (MVP Analytics)
app.use("/api", healthRoutes); // 🏥 Health Check (GET /api/health)
app.use("/mailflow", mailflowRoutes); // 📧 MailFlow - Onboarding Sequences
app.use("/modules", modulePreviewRoutes); // 🎯 Generic Preview Mode (Public + Auth endpoints)
app.use("/video-express", videoExpressRoutes); // 🎬 Product Video Express - AI Video Generation (Auth)
app.use("/video-express/preview", videoExpressPreviewRoutes); // 🎬 Video Express Preview (Public)
app.use("/", mvpHubRoutes); // 🏠 MVP Hub - Dynamic MVP listing (Public)
app.use("/mvp-analytics", mvpAnalyticsRoutes); // 📊 MVP Analytics - Aggregated stats from tracking_events
app.use("/finance", financeRoutes); // 💰 Finance Module - Personal financial management (Admin)
app.use("/public/inbox-zero", inboxZeroPreventionRoutes); // 📬 Inbox Zero Prevention - Public setup requests (No auth)

export default app;
