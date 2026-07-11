function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesStrictText(value: string, query: string) {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);

  return Boolean(normalizedQuery) && normalizedValue.includes(normalizedQuery);
}

export function matchesTightName(value: string, query: string) {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return true;
  }

  if (/\d/.test(query) || query.includes("@")) {
    return false;
  }

  const valueTokens = normalizedValue.split(" ").filter(Boolean);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  return queryTokens.every((queryToken) =>
    valueTokens.some((valueToken) => tokensAreTightMatch(valueToken, queryToken)),
  );
}

function tokensAreTightMatch(valueToken: string, queryToken: string) {
  if (valueToken.includes(queryToken) || queryToken.includes(valueToken)) {
    return true;
  }

  const maximumDistance = queryToken.length >= 10 ? 2 : queryToken.length >= 4 ? 1 : 0;

  if (
    maximumDistance === 0 ||
    Math.abs(valueToken.length - queryToken.length) > maximumDistance
  ) {
    return false;
  }

  return boundedDamerauLevenshtein(valueToken, queryToken, maximumDistance) <= maximumDistance;
}

function boundedDamerauLevenshtein(
  first: string,
  second: string,
  maximumDistance: number,
) {
  const rows = first.length + 1;
  const columns = second.length + 1;
  const distances = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0),
  );

  for (let row = 0; row < rows; row += 1) {
    distances[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    distances[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    let rowMinimum = maximumDistance + 1;

    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = first[row - 1] === second[column - 1] ? 0 : 1;
      let distance = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + substitutionCost,
      );

      if (
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        distance = Math.min(distance, distances[row - 2][column - 2] + 1);
      }

      distances[row][column] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > maximumDistance && row > second.length + maximumDistance) {
      return maximumDistance + 1;
    }
  }

  return distances[first.length][second.length];
}
