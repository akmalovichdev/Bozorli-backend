const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/payments/create:
 *   post:
 *     summary: Create payment for order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - provider
 *             properties:
 *               orderId:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [click, payme, uzum, stripe]
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentId:
 *                       type: string
 *                     paymentUrl:
 *                       type: string
 *                     providerPaymentId:
 *                       type: string
 */
router.post('/create',
  authenticateToken,
  [
    body('orderId').isString().notEmpty(),
    body('provider').isIn(['click', 'payme', 'uzum', 'stripe']),
    body('amount').optional().isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { orderId, provider, amount } = req.body;

      // Verify order exists and belongs to user
      const order = await Order.findOne({
        where: { id: orderId, user_id: req.user.id }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.paymentStatus === 'paid') {
        return res.status(400).json({ success: false, error: 'Order already paid' });
      }

      const paymentAmount = amount || order.totalAmount;
      const providerPaymentId = `${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create payment record
      const payment = await Payment.create({
        orderId,
        provider,
        providerPaymentId,
        amount: paymentAmount,
        status: 'pending',
        metadata: {
          user_id: req.user.id,
          orderNumber: order.id,
          createdAt: new Date().toISOString()
        }
      });

      // Generate payment URL based on provider
      let paymentUrl = '';
      switch (provider) {
        case 'click':
          paymentUrl = `https://my.click.uz/services/pay?service_id=YOUR_SERVICE_ID&merchant_id=YOUR_MERCHANT_ID&amount=${paymentAmount}&transaction_param=${payment.id}`;
          break;
        case 'payme':
          paymentUrl = `https://checkout.paycom.uz/${providerPaymentId}`;
          break;
        case 'uzum':
          paymentUrl = `https://uzumbank.uz/payment/${providerPaymentId}`;
          break;
        case 'stripe':
          paymentUrl = `https://checkout.stripe.com/pay/${providerPaymentId}`;
          break;
      }

      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          paymentUrl,
          providerPaymentId,
          amount: paymentAmount
        }
      });
    } catch (error) {
      logger.error('Create payment error:', error);
      res.status(500).json({ success: false, error: 'Failed to create payment' });
    }
  }
);

/**
 * @swagger
 * /api/v1/payments/{paymentId}/status:
 *   get:
 *     summary: Get payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 */
router.get('/:paymentId/status', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      where: { id: paymentId },
      include: [
        {
          model: Order,
          as: 'order',
          where: { user_id: req.user.id },
          attributes: ['id', 'totalAmount', 'status']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Get payment status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment status' });
  }
});

/**
 * @swagger
 * /api/v1/payments/webhook/{provider}:
 *   post:
 *     summary: Payment webhook handler
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [click, payme, uzum, stripe]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/webhook/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const webhookData = req.body;

    logger.info(`Received ${provider} webhook:`, webhookData);

    // Verify webhook signature (implement based on provider)
    // if (!verifyWebhookSignature(provider, req.headers, webhookData)) {
    //   return res.status(400).json({ error: 'Invalid signature' });
    // }

    // Process webhook based on provider
    let paymentId, status, transactionId;

    switch (provider) {
      case 'click':
        paymentId = webhookData.merchant_trans_id;
        status = webhookData.status === 'success' ? 'captured' : 'failed';
        transactionId = webhookData.click_trans_id;
        break;
      case 'payme':
        paymentId = webhookData.params.id;
        status = webhookData.result.status === 'success' ? 'captured' : 'failed';
        transactionId = webhookData.result.transaction;
        break;
      case 'uzum':
        paymentId = webhookData.payment_id;
        status = webhookData.status === 'completed' ? 'captured' : 'failed';
        transactionId = webhookData.transaction_id;
        break;
      case 'stripe':
        paymentId = webhookData.data.object.metadata.payment_id;
        status = webhookData.data.object.status === 'succeeded' ? 'captured' : 'failed';
        transactionId = webhookData.data.object.id;
        break;
    }

    if (paymentId) {
      const payment = await Payment.findByPk(paymentId);
      if (payment) {
        payment.status = status;
        payment.providerPaymentId = transactionId;
        if (status === 'captured') {
          payment.capturedAt = new Date();
          
          // Update order payment status
          await Order.update(
            { paymentStatus: 'paid' },
            { where: { id: payment.orderId } }
          );
        }
        await payment.save();

        // Emit WebSocket event
        const io = req.app.get('io');
        if (io) {
          io.to(`order_${payment.orderId}`).emit('payment_update', {
            paymentId: payment.id,
            status: payment.status,
            orderId: payment.orderId
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @swagger
 * /api/v1/payments/refund:
 *   post:
 *     summary: Refund payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - reason
 *             properties:
 *               paymentId:
 *                 type: string
 *               reason:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Refund initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     refundId:
 *                       type: string
 *                     status:
 *                       type: string
 */
router.post('/refund',
  authenticateToken,
  [
    body('paymentId').isString().notEmpty(),
    body('reason').isString().notEmpty(),
    body('amount').optional().isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { paymentId, reason, amount } = req.body;

      const payment = await Payment.findOne({
        where: { id: paymentId },
        include: [
          {
            model: Order,
            as: 'order',
            where: { user_id: req.user.id }
          }
        ]
      });

      if (!payment) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      if (payment.status !== 'captured') {
        return res.status(400).json({ success: false, error: 'Payment cannot be refunded' });
      }

      const refundAmount = amount || payment.amount;
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // In real app, would call provider's refund API
      logger.info(`Initiating refund for payment ${paymentId}: ${refundAmount} UZS`);

      // Update payment status
      payment.status = 'refunded';
      payment.metadata = {
        ...payment.metadata,
        refund: {
          id: refundId,
          amount: refundAmount,
          reason,
          requestedAt: new Date().toISOString(),
          requestedBy: req.user.id
        }
      };
      await payment.save();

      res.json({
        success: true,
        data: {
          refundId,
          status: 'pending',
          amount: refundAmount
        }
      });
    } catch (error) {
      logger.error('Refund payment error:', error);
      res.status(500).json({ success: false, error: 'Failed to process refund' });
    }
  }
);

module.exports = router;

