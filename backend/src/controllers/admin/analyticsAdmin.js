const h = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const analytics = require('../../services/analyticsService');

module.exports = { dashboard: h(async (req, res) => ok(res, await analytics.dashboard(req.query))) };
