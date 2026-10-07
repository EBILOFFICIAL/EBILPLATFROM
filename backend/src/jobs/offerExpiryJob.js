const offers = require('../services/offerService');

module.exports = async () => {
  const expired = await offers.expireOffers();
  const noShows = await offers.processNoShows();
  return { processed: expired.processed + noShows.processed, changes: expired.changes + noShows.changes };
};
