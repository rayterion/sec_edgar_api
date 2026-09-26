import { EdgarError, assertInput, schema } from "../errors.js";
import { record } from "../parsers/json.js";
export function normalizeCik(cik) {
    const value = String(cik);
    assertInput(/^\d{1,10}$/.test(value), "CIK must contain 1 to 10 digits");
    return value.padStart(10, "0");
}
export function tickerName(ticker) {
    assertInput(/^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$/.test(ticker), "Invalid ticker");
    return ticker.toUpperCase();
}
export class CompaniesApi {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    async lookup(options = {}) {
        const url = "https://www.sec.gov/files/company_tickers_exchange.json";
        const value = await this.transport.json(url, options);
        schema(record(value) && Array.isArray(value.fields) && Array.isArray(value.data), "Invalid ticker exchange lookup", url);
        const fields = value.fields;
        const data = value.data;
        const indexes = ["cik", "name", "ticker", "exchange"].map((field) => fields.indexOf(field));
        schema(indexes.slice(0, 3).every((x) => x >= 0), "Ticker lookup missing required columns", url);
        return data.map((row) => {
            schema(Array.isArray(row), "Ticker lookup row must be an array", url);
            const [c, n, t, e] = indexes.map((i) => row[i]);
            schema((typeof c === "number" || typeof c === "string") &&
                typeof n === "string" &&
                typeof t === "string", "Invalid ticker lookup row", url);
            return {
                cik: normalizeCik(c),
                name: n,
                ticker: t,
                exchange: typeof e === "string" ? e : null,
            };
        });
    }
    async resolve(identifier, options = {}) {
        assertInput(record(identifier) &&
            (identifier.ticker !== undefined) !== (identifier.cik !== undefined), "Provide ticker or cik");
        const companies = await this.lookup(options);
        const matches = "ticker" in identifier && identifier.ticker !== undefined
            ? companies.filter((x) => x.ticker === tickerName(identifier.ticker))
            : companies.filter((x) => x.cik === normalizeCik(identifier.cik));
        if (!matches.length) {
            if ("cik" in identifier && identifier.cik !== undefined) {
                const cik = normalizeCik(identifier.cik);
                const submission = await this.transport.json(`https://data.sec.gov/submissions/CIK${cik}.json`, options);
                schema(record(submission) && typeof submission.name === "string", "Invalid submissions company metadata");
                return { cik, ticker: null, name: submission.name };
            }
            throw new EdgarError("NOT_FOUND", "Ticker was not found in the SEC lookup file");
        }
        return matches[0];
    }
    async search(name, options = {}) {
        assertInput(name.trim().length >= 2, "Search name must have at least two characters");
        return (await this.lookup(options)).filter((x) => x.name.toLowerCase().includes(name.trim().toLowerCase()));
    }
    async get(identifier, options = {}) {
        const company = await this.resolve(identifier, options);
        const url = `https://data.sec.gov/submissions/CIK${company.cik}.json`;
        const submissions = await this.transport.json(url, options);
        schema(record(submissions) &&
            typeof submissions.name === "string" &&
            record(submissions.filings), "Invalid company submissions", url);
        return { ...company, name: submissions.name, submissions };
    }
}
