import express from "express";
import productsRoutes from './products.routes.js';
import usersRoutes from './users.routes.js';
import guestsRoutes from './guests.routes.js';
import categoriesRoutes from "./categories.routes.js";
import slidersRoutes from "./sliders.routes.js";
import cuponesRoutes from "./cupone.routes.js";
import discountsRoutes from "./discount.routes.js";
import homeRoutes from "./home.routes.js";
import cartsRoutes from "./carts.routes.js";
import cartsCacheRoutes from "./cartsCache.routes.js"; // Guest
import addressClient from "./addressClient.routes.js";
import addressGuest from "./addressGuest.routes.js"; // Guest
import sale from "./sale.routes.js";
import shipping from "./shipping.routes.js";
import review from "./review.routes.js";
import productsPrintfulRoutes from "./productsPrintful.routes.js";
import productsGelatoRoutes from "./productsGelato.routes.js";
import productsDropiRoutes from "./productsDropi.routes.js";
import wishlistRoutes from "./wishlist.routes.js";
import shippingratesRoutes from "./shippingrates.route.js";
import stripeRoutes from "./stripe.routes.js";
import paypalRoutes from "./paypal.routes.js";
import chatRoutes from './chat/chat.routes.js';
import chatTenantRoutes from './chat-tenant.routes.js'; // 🚀 Multi-Tenant Chat SaaS
import saleRoutes  from './sale.routes.js';
import ReturnRoutes from './returns.routes.js';
import Inbox from './inbox.routes.js';
import receiptRoutes from './receipt.routes.js';
// Webhook de Printful
import printfulWebhook from './printfulWebhook.routes.js';
import notifications from './notifications.routes.js';
import prelaunchRoutes from './prelaunch.routes.js';
import newsletterRoutes from './newsletter.routes.js';
import postalCodeRoutes from './postalCode.routes.js';
import analyticsRoutes from './analytics.routes.js';
import trackingRoutes from './tracking.routes.js';
import trackingEventsRoutes from './trackingEvents.routes.js'; // 📊 Tracking de eventos del funnel
import backupsRoutes from './backups.routes.js';
import databaseManagementRoutes from './database-management.routes.js';
import seoRoutes from './seo.routes.js'; // ✅ SEO Management (Sitemap & Robots.txt)
import emailTestingRoutes from './emailTesting.routes.js'; // 🧪 Email Testing
import modulesRoutes from './modules.routes.js'; // 🚀 Multi-Module System (Levels-style)
import saasRoutes from './saas.routes.js'; // 🚀 SaaS Tenants & Trials
import saasEmailTestingRoutes from './saas-email-testing.routes.js'; // 🧪 SaaS Email Testing
import saasAdminRoutes from './saas-admin.routes.js'; // 🔧 SaaS Admin Management
import healthRoutes from './health.routes.js'; // 🏥 Health Check
import mailflowRoutes from './mailflow.routes.js'; // 📧 MailFlow - Onboarding Sequences
import modulePreviewRoutes from './modulePreview.routes.js'; // 🎯 Generic Preview Mode for any SaaS module
import videoExpressRoutes from './videoExpress.routes.js'; // 🎬 Product Video Express - AI Video Generation
import videoExpressPreviewRoutes from './videoExpressPreview.routes.js'; // 🎬 Video Express Preview (Public)
import mvpHubRoutes from './mvpHub.routes.js'; // 🏠 MVP Hub - Dynamic listing of available MVPs
import mvpAnalyticsRoutes from './mvpAnalytics.routes.js'; // 📊 MVP Analytics - Dynamic analytics from tracking_events
import financeRoutes from './finance.routes.js'; // 💰 Finance Module - Personal financial management

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
app.use("/admin/saas", saasAdminRoutes); // 🔧 SaaS Admin Management (Tenant CRUD + Tracking Events)
app.use("/api", healthRoutes); // 🏥 Health Check (GET /api/health)
app.use("/mailflow", mailflowRoutes); // 📧 MailFlow - Onboarding Sequences
app.use("/modules", modulePreviewRoutes); // 🎯 Generic Preview Mode (Public + Auth endpoints)
app.use("/video-express", videoExpressRoutes); // 🎬 Product Video Express - AI Video Generation (Auth)
app.use("/video-express/preview", videoExpressPreviewRoutes); // 🎬 Video Express Preview (Public)
app.use("/", mvpHubRoutes); // 🏠 MVP Hub - Dynamic MVP listing (Public)
app.use("/mvp-analytics", mvpAnalyticsRoutes); // 📊 MVP Analytics - Aggregated stats from tracking_events
app.use("/finance", financeRoutes); // 💰 Finance Module - Personal financial management (Admin)

export default app;
