const usage = "Usage: npm start -- TICKER YEAR QUARTER";

export function parseQuery(args) {
  if (args.length !== 3) throw new Error(usage);
  const [ticker, year, quarter] = args;
  if (!/^[A-Za-z][A-Za-z0-9.-]*$/.test(ticker)) throw new Error(usage);
  if (!/^\d{4}$/.test(year) || !/^[1-4]$/.test(quarter)) {
    throw new Error(usage);
  }
  return {
    ticker: ticker.toUpperCase(),
    fiscalYear: Number(year),
    fiscalQuarter: Number(quarter),
  };
}

export async function getStatements(client, query) {
  const [income, balance] = await Promise.all([
    client.financials.incomeStatement(query),
    client.financials.balanceSheet(query),
  ]);
  return { income, balance };
}
