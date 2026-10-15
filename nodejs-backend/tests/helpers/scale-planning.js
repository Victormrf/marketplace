// Count-only planning for configuration tests; no records or random data are generated.
function allocateQuotas(total, weights) {
  const entries = Object.entries(weights).map(([key, share], index) => {
    const expected = total * share;

    return {
      key,
      index,
      count: Math.floor(expected),
      expected,
    };
  });
  const remainder = total - entries.reduce((sum, entry) => sum + entry.count, 0);
  const ranked = [...entries].sort((left, right) => {
    const difference =
      right.expected - right.count - (left.expected - left.count);

    return Math.abs(difference) < 1e-10 ? left.index - right.index : difference;
  });

  for (let index = 0; index < remainder; index += 1) {
    ranked[index].count += 1;
  }

  return Object.fromEntries(entries.map((entry) => [entry.key, entry.count]));
}

function planSellerOrderScenarios(profile, distributions) {
  const paidSellerOrders = Math.round(
    profile.estimated.sellerOrders * profile.derivation.capturedOrdersRate
  );
  const scenarios = distributions.sellerOrders.scenarios;
  const quotas = allocateQuotas(
    paidSellerOrders,
    Object.fromEntries(
      Object.entries(scenarios).map(([name, scenario]) => [name, scenario.share])
    )
  );
  let sellerOrderStatusHistories =
    profile.estimated.sellerOrders - paidSellerOrders;
  let deliveryStatusHistories = 0;
  let deliveries = 0;

  for (const [name, count] of Object.entries(quotas)) {
    const scenario = scenarios[name];
    sellerOrderStatusHistories += count * scenario.sellerOrderPath.length;
    deliveryStatusHistories += count * scenario.deliveryPath.length;

    if (scenario.deliveryPath.length > 0) {
      deliveries += count;
    }
  }

  return {
    paidSellerOrders,
    quotas,
    deliveries,
    sellerOrderStatusHistories,
    deliveryStatusHistories,
  };
}

module.exports = { allocateQuotas, planSellerOrderScenarios };
