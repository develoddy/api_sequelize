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
import stripeRoutes from "./stripe.routes.js"
import chatRoutes from './chat/chat.routes.js';
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
app.use("/chat", chatRoutes);
app.use("/sales", saleRoutes);
app.use("/returns", ReturnRoutes);
app.use("/inbox", Inbox);
app.use("/receipts", receiptRoutes);
// Webhook de Printful
app.use("/printfulWebhook", printfulWebhook);
app.use("/notifications", notifications);
app.use("/prelaunch", prelaunchRoutes);
app.use("/newsletter", newsletterRoutes);
app.use("/postal-codes", postalCodeRoutes);

export default app;
