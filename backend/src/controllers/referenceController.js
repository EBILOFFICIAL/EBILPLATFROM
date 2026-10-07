const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const references = require('../services/referenceService');
const tickets = require('../services/ticketService');

module.exports = {
  list: h(async (req, res) => ok(res, await references.list(req.employer._id))),
  create: h(async (req, res) => created(res, await references.create(req.employer, req.user, req.body), 'Reference request created')),
  respond: h(async (req, res) => ok(res, await references.respond(req.employer, req.params.id, req.body.response), 'Reference submitted')),
  myTickets: h(async (req, res) => ok(res, await tickets.mine(req.user._id))),
  createTicket: h(async (req, res) => created(res, await tickets.create(req.user, req.body), 'Ticket created')),
  replyTicket: h(async (req, res) => ok(res, await tickets.reply(req.params.id, req.user, { text: req.body.text }, false), 'Reply sent')),
};
