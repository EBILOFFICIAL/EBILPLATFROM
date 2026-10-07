function getPagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const max = query.export === '1' || query.export === true ? 5000 : 100;
  const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

const endOfDay = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T23:59:59.999Z`) : new Date(d));

// Adds a createdAt range from ?from=YYYY-MM-DD&to=YYYY-MM-DD to any list query
function withDateRange(filter = {}, query = {}) {
  if (!query.from && !query.to) return filter;
  const range = { ...(query.from && { $gte: new Date(query.from) }), ...(query.to && { $lte: endOfDay(query.to) }) };
  return { ...filter, createdAt: { ...(filter.createdAt || {}), ...range } };
}

async function paginate(model, rawFilter, query = {}, { sort = { createdAt: -1 }, populate, select } = {}) {
  const filter = withDateRange(rawFilter, query);
  const { page, limit, skip } = getPagination(query);
  let q = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) q = q.populate(populate);
  if (select) q = q.select(select);
  const [items, total] = await Promise.all([q.lean(), model.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { getPagination, paginate, withDateRange };
