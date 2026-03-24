function tokenizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function normalizeSearchText(value) {
  return tokenizeSearchText(value).join(" ");
}

function compactSearchText(value) {
  return tokenizeSearchText(value).join("");
}

function buildSearchFields(facility) {
  const equipment = Array.isArray(facility.equipment) ? facility.equipment : [];
  return [
    { value: facility.id, weight: 1.45 },
    { value: facility.name, weight: 1.35 },
    { value: facility.building, weight: 1.1 },
    { value: facility.type, weight: 0.9 },
    ...equipment.map((item) => ({ value: item, weight: 0.8 })),
  ]
    .map((field) => {
      const text = normalizeSearchText(field.value);
      const compact = compactSearchText(field.value);
      const tokens = tokenizeSearchText(field.value);
      return { ...field, text, compact, tokens };
    })
    .filter((field) => field.text || field.compact);
}

function scoreSearchToken(token, field) {
  if (!token || !field) return 0;
  const weight = Number(field.weight) || 1;

  if (field.tokens.includes(token)) return 42 * weight;
  if (field.tokens.some((candidate) => candidate.startsWith(token))) return 30 * weight;
  if (field.tokens.some((candidate) => candidate.includes(token))) return 20 * weight;
  if (field.compact.includes(token)) return 14 * weight;
  return 0;
}

function scoreFacilitySearch(query, facility) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenizeSearchText(query);
  const queryCompact = compactSearchText(query);
  const fields = buildSearchFields(facility);
  if (!fields.length) return null;

  let score = 0;

  for (const token of queryTokens) {
    let bestTokenScore = 0;
    for (const field of fields) {
      bestTokenScore = Math.max(bestTokenScore, scoreSearchToken(token, field));
    }
    if (bestTokenScore <= 0) return null;
    score += bestTokenScore;
  }

  for (const field of fields) {
    if (field.text === normalizedQuery || (queryCompact && field.compact === queryCompact)) {
      score += 240 * field.weight;
      continue;
    }
    if (field.text.startsWith(normalizedQuery) || (queryCompact && field.compact.startsWith(queryCompact))) {
      score += 140 * field.weight;
      continue;
    }
    if (field.text.includes(normalizedQuery) || (queryCompact && field.compact.includes(queryCompact))) {
      score += 95 * field.weight;
    }
  }

  score += queryTokens.length * 5;
  return score;
}

function rankFacilities(items, query) {
  if (!Array.isArray(items)) return [];
  const normalizedQuery = normalizeSearchText(query);

  const ranked = items
    .map((facility) => ({ facility, score: normalizedQuery ? scoreFacilitySearch(query, facility) : 0 }))
    .filter((entry) => !normalizedQuery || entry.score !== null)
    .sort((left, right) => {
      if ((right.score || 0) !== (left.score || 0)) return (right.score || 0) - (left.score || 0);

      const byName = String(left.facility.name || "").localeCompare(String(right.facility.name || ""));
      if (byName !== 0) return byName;
      return String(left.facility.id || "").localeCompare(String(right.facility.id || ""));
    });

  return ranked.map((entry) => entry.facility);
}

function buildSearchCacheKey(query) {
  const params = new URLSearchParams();
  for (const key of Object.keys(query || {}).sort()) {
    const value = query[key];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  return `facilities:${params.toString()}`;
}

module.exports = {
  buildSearchCacheKey,
  rankFacilities,
};