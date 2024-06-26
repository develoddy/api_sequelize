import express from "express";
import productsRoutes from './products.routes.js';
import usersRoutes from './users.routes.js';
import categoriesRoutes from "./categories.routes.js";
import slidersRoutes from "./sliders.routes.js";
import cuponesRoutes from "./cupone.routes.js";
import discountsRoutes from "./discount.routes.js";
import homeRoutes from "./home.routes.js";
import cartsRoutes from "./carts.routes.js";
import addressClient from "./addressClient.routes.js";
import sale from "./sale.routes.js";
import review from "./review.routes.js";
import productsPrintfulRoutes from "./productsPrintful.routes.js";
import productsGelatoRoutes from "./productsGelato.routes.js";

const app = express();

app.use("/users", usersRoutes);
app.use("/products", productsRoutes);
app.use("/categories", categoriesRoutes);
app.use("/sliders", slidersRoutes);
app.use("/cupones", cuponesRoutes);
app.use("/discounts", discountsRoutes);
app.use("/home", homeRoutes);
app.use("/cart", cartsRoutes);
app.use("/address_client", addressClient);
app.use("/sale", sale);
app.use("/review", review);
app.use("/printful", productsPrintfulRoutes);
app.use("/gelato", productsGelatoRoutes);

export default app;