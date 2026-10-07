const h = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const offers = require('../services/offerService');
const disputes = require('../services/disputeService');
const Offer = require('../models/Offer');

module.exports = {
  employeeList: h(async (req, res) => ok(res, await Offer.find({ employeeId: req.profile._id }).select('+ctcPrivate').populate('employerId', 'companyName').sort({ createdAt: -1 }).lean())),
  selfDeclare: h(async (req, res) => created(res, await offers.selfDeclare(req.profile, req.user, req.body), 'Offer recorded as Unverified until the company confirms')),
  requestOtp: h(async (req, res) => ok(res, await offers.requestAcceptOtp(req.profile, req.user, req.params.id), 'Acceptance code sent to your email')),
  accept: h(async (req, res) => ok(res, await offers.accept(req.profile, req.user, req.params.id, req.body.code), 'Offer accepted')),
  decline: h(async (req, res) => ok(res, await offers.decline(req.profile, req.user, req.params.id), 'Offer declined')),
  dispute: h(async (req, res) => created(res, await disputes.raise(req.profile, req.user, { targetType: 'offer', targetId: req.params.id, reason: req.body.reason }), 'Dispute raised')),
  employerList: h(async (req, res) => ok(res, await Offer.find({ employerId: req.employer._id }).populate('employeeId', 'fullName eibilId').sort({ createdAt: -1 }).lean())),
  issue: h(async (req, res) => created(res, await offers.issue(req.employer, req.user, req.body, req.file), 'Offer issued')),
  employerGet: h(async (req, res) => ok(res, await offers.getEmployerOffer(req.employer, req.params.id))),
  employerPatch: h(async (req, res) => {
    const offer = await offers.getEmployerOffer(req.employer, req.params.id);
    if (offer.status !== 'issued') return ok(res, offer, 'Only issued offers can be edited');
    ['designation', 'department', 'location', 'validUntil', 'expectedJoiningDate'].forEach((k) => { if (req.body[k] !== undefined) offer[k] = req.body[k]; });
    return ok(res, await offer.save(), 'Offer updated');
  }),
  confirmJoin: h(async (req, res) => ok(res, await offers.confirmJoin(req.employer, req.user, req.params.id), 'Joining confirmed. Employment record created')),
  noShow: h(async (req, res) => ok(res, await offers.markNoShow(req.employer, req.user, req.params.id), 'Marked as no-show')),
  withdraw: h(async (req, res) => ok(res, await offers.withdraw(req.employer, req.user, req.params.id, req.body.reason), 'Offer withdrawn')),
  candidateOfferStatus: h(async (req, res) => ok(res, await offers.offerStatusForEmployer(req.employer, req.params.id))),
};
