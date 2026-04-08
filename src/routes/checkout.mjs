import express from "express";
import { getProductBySlug } from "../catalog.mjs";
import { HttpError } from "../lib/httpError.mjs";
import { createOrderRecord, findOrderByProviderOrderId, markOrderPaid, storeDownloadToken, storeLicense } from "../services/orderService.mjs";
import { capturePayPalOrder, createPayPalCheckout } from "../services/paypalService.mjs";
import { createSumUpCheckout, getSumUpCheckout } from "../services/sumupService.mjs";
import { createLicenseRecord } from "../services/licenseService.mjs";
import { createDownloadToken } from "../services/downloadService.mjs";
import { sendLicenseEmail } from "../services/emailService.mjs";
import { config } from "../config.mjs";

export const checkoutRouter = express.Router();

function validateBody(body) {
  if (!body?.buyerEmail || !body?.productSlug) {
    throw new HttpError(400, "buyerEmail and productSlug are required.");
  }

  const product = getProductBySlug(body.productSlug);

  if (!product) {
    throw new HttpError(404, "Product not found.");
  }

  return product;
}

checkoutRouter.post("/paypal/create", async (req, res, next) => {
  try {
    const product = validateBody(req.body);
    const checkout = await createPayPalCheckout({
      product,
      buyerEmail: req.body.buyerEmail,
    });

    const order = await createOrderRecord({
      provider: checkout.provider,
      externalId: checkout.externalId,
      product,
      buyerEmail: req.body.buyerEmail,
    });

    res.json({
      checkoutUrl: checkout.checkoutUrl,
      orderId: order.id,
    });
  } catch (error) {
    next(error);
  }
});

checkoutRouter.post("/sumup/create", async (req, res, next) => {
  try {
    const product = validateBody(req.body);
    const checkout = await createSumUpCheckout({
      product,
    });

    const order = await createOrderRecord({
      provider: checkout.provider,
      externalId: checkout.externalId,
      product,
      buyerEmail: req.body.buyerEmail,
    });

    res.json({
      checkoutId: checkout.checkoutId,
      checkoutReference: checkout.checkoutReference,
      orderId: order.id,
    });
  } catch (error) {
    next(error);
  }
});

checkoutRouter.post("/paypal/capture", async (req, res, next) => {
  try {
    const { orderId, productSlug } = req.body || {};

    if (!orderId || !productSlug) {
      throw new HttpError(400, "orderId and productSlug are required.");
    }

    const product = getProductBySlug(productSlug);

    if (!product) {
      throw new HttpError(404, "Product not found.");
    }

    const capture = await capturePayPalOrder(orderId);
    const order = await findOrderByProviderOrderId(orderId);

    if (!order) {
      throw new HttpError(404, "Order record not found for the PayPal order.");
    }

    await markOrderPaid({ providerOrderId: orderId });

    const license = createLicenseRecord(product.code);
    const token = createDownloadToken();
    const downloadUrl = `${config.appBaseUrl}/api/download/${token.token}`;

    await storeLicense({ orderId: order.id, productId: product.id, license });
    await storeDownloadToken({ orderId: order.id, token });
    await sendLicenseEmail({
      buyerEmail: order.buyer_email,
      productName: product.name,
      serial: license.serial,
      downloadUrl,
    });

    res.json({
      ok: true,
      captureId: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || null,
      serialLast4: license.serialLast4,
      downloadUrl,
    });
  } catch (error) {
    next(error);
  }
});

checkoutRouter.post("/sumup/confirm", async (req, res, next) => {
  try {
    const { checkoutId, productSlug } = req.body || {};

    if (!checkoutId || !productSlug) {
      throw new HttpError(400, "checkoutId and productSlug are required.");
    }

    const product = getProductBySlug(productSlug);

    if (!product) {
      throw new HttpError(404, "Product not found.");
    }

    const checkout = await getSumUpCheckout(checkoutId);

    if (checkout.status !== "PAID") {
      throw new HttpError(409, "SumUp checkout is not marked as paid yet.", checkout);
    }

    const order = await findOrderByProviderOrderId(checkoutId);

    if (!order) {
      throw new HttpError(404, "Order record not found for the SumUp checkout.");
    }

    await markOrderPaid({ providerOrderId: checkoutId });

    const license = createLicenseRecord(product.code);
    const token = createDownloadToken();
    const downloadUrl = `${config.appBaseUrl}/api/download/${token.token}`;

    await storeLicense({ orderId: order.id, productId: product.id, license });
    await storeDownloadToken({ orderId: order.id, token });
    await sendLicenseEmail({
      buyerEmail: order.buyer_email,
      productName: product.name,
      serial: license.serial,
      downloadUrl,
    });

    res.json({
      ok: true,
      checkoutId,
      serialLast4: license.serialLast4,
      downloadUrl,
    });
  } catch (error) {
    next(error);
  }
});
