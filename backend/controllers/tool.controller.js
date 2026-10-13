const journeyService = require('../services/journey.service');
const turnService = require('../services/turn.service');
const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/response');
const logger = require('../config/logger');

const toolResult = (res, result, defaultMessage) => {
  const message = result.say || defaultMessage;
  if (result.success) {
    return success(res, result, message);
  }
  return res.status(200).json({
    success: false,
    message,
    data: result,
    errorCode: result.reason || result.outcome || 'BACKEND_ERROR',
  });
};

const resolveDelivery = async (req, res, next) => {
  try {
    const orderReference =
      req.body.orderReference || req.body.order_reference || req.body.lastOrderReference;
    logger.info(`Tool resolve-delivery: ${orderReference}`, {
      phone: req.body.phone,
      correlationId: req.body.correlationId,
    });
    const result = await journeyService.handleDriverVerification(orderReference, req.body);
    return toolResult(res, result, 'Delivery resolved');
  } catch (error) {
    return next(error);
  }
};

const confirmDelivery = async (req, res, next) => {
  try {
    logger.info(`Tool confirm-delivery: ${JSON.stringify(req.body)}`);
    const result = await journeyService.handleConfirmDelivery(req.body);
    return toolResult(res, result, 'Delivery confirmed');
  } catch (error) {
    return next(error);
  }
};

const registerDelivery = async (req, res, next) => {
  try {
    logger.info(`Tool register-delivery: ${JSON.stringify(req.body)}`);
    const result = await journeyService.handleWhatsappRegistration(req.body);
    return toolResult(res, result, 'Delivery registered');
  } catch (error) {
    return next(error);
  }
};

const findCustomer = async (req, res, next) => {
  try {
    logger.info(`Tool find-customer: ${JSON.stringify(req.body)}`);
    const result = await journeyService.handleFindCustomer(req.body);
    return toolResult(res, result, 'Customer lookup complete');
  } catch (error) {
    return next(error);
  }
};

const clearLockerSession = async (req, res, next) => {
  try {
    const { orderReference, boxId, deliverySessionId } = req.body;
    logger.info(
      `Tool clear-locker-session: ${JSON.stringify({ orderReference, boxId, deliverySessionId })}`
    );
    const result = await journeyService.handleClearLockerSession({
      orderReference,
      boxId,
      deliverySessionId,
    });
    return toolResult(res, result, 'Locker session cleared');
  } catch (error) {
    return next(error);
  }
};

const validateOtp = async (req, res, next) => {
  try {
    logger.info(`Tool validate-otp: ${JSON.stringify({ ...req.body, otp: '[redacted]' })}`);
    const result = await journeyService.handleValidateOtp(req.body);
    return toolResult(res, result, result.valid ? 'OTP valid' : 'OTP invalid');
  } catch (error) {
    return next(error);
  }
};

const getDeliveryStatus = async (req, res, next) => {
  try {
    const orderReference =
      req.body.orderReference || req.body.order_reference || req.params.orderReference;
    logger.info(`Tool get-delivery-status: ${orderReference}`);
    const result = await journeyService.handleGetDeliveryStatus(orderReference);
    return toolResult(res, result, 'Delivery status');
  } catch (error) {
    return next(error);
  }
};

const createSupportTicket = async (req, res, next) => {
  try {
    const ticket = req.body.ticket || req.body;
    const ticketId = ticket.ticket_id || ticket.ticketId || `TCK-${Date.now()}`;
    logger.info(`Tool create-support-ticket: ${ticketId}`);

    await AuditLog.create({
      userName: 'n8n-agent',
      action: 'create_support_ticket',
      resource: ticketId,
      afterValue: JSON.stringify(ticket).slice(0, 4000),
    }).catch((err) => logger.warn(`Support ticket audit failed: ${err.message}`));

    return success(
      res,
      {
        ticketId,
        status: 'queued',
        priority: ticket.priority || 'P3',
        correlationId: ticket.correlation_id || ticket.correlationId || req.body.correlationId,
      },
      'Support ticket created'
    );
  } catch (error) {
    return next(error);
  }
};

const identifyWhatsapp = async (req, res, next) => {
  try {
    logger.info(`Tool identify-whatsapp: ${req.body.whatsappPhone || req.body.phone}`);
    const result = await journeyService.handleIdentify(req.body);
    return toolResult(res, result, 'Identify complete');
  } catch (error) {
    return next(error);
  }
};

const notifyRecipient = async (req, res, next) => {
  try {
    logger.info(`Tool notify-recipient: ${JSON.stringify(req.body)}`);
    const result = await journeyService.handleNotifyRecipient(req.body);
    return toolResult(res, result, 'Notify complete');
  } catch (error) {
    return next(error);
  }
};

const conversationTurn = async (req, res, next) => {
  try {
    const result = await turnService.handle(req.body);
    return success(res, result, result.outcome || 'turn');
  } catch (error) {
    logger.error(`Tool conversation-turn failed: ${error.stack || error.message}`);
    return next(error);
  }
};

module.exports = {
  conversationTurn,
  resolveDelivery,
  confirmDelivery,
  registerDelivery,
  findCustomer,
  clearLockerSession,
  validateOtp,
  getDeliveryStatus,
  createSupportTicket,
  identifyWhatsapp,
  notifyRecipient,
};
