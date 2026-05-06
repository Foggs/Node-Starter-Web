/**
 * Google Sheets client — thin, typed wrapper around the Sheets v4 API.
 *
 * Used by POST /api/leads to capture lead data from the landing-page demo
 * modal into the "Exit Coach Leads" sheet.
 *
 * Security & lifecycle rules:
 *  - Service account JSON is read from `GOOGLE_SERVICE_ACCOUNT_JSON` at first
 *    call site only — importing this module must have zero side effects so
 *    tests can `vi.mock` without ever touching `googleapis` or the network.
 *  - Sheet ID is read from `LEADS_SHEET_ID` at call time.
 *  - All config errors surface as `LeadsConfigError` so the route handler
 *    can map them to a generic 500 without leaking secrets.
 */

import { google, type sheets_v4 } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const LEAD_SOURCE = "demo_modal";

/** Sheet ranges — Sheet1 is the default tab created when a sheet is first made. */
const EMAIL_COLUMN_RANGE = "Sheet1!C:C";
const APPEND_RANGE = "Sheet1!A:D";

export class LeadsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadsConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let cachedClient: sheets_v4.Sheets | undefined;

/**
 * Lazily build (and memoise) the Sheets client. Reads env at first call only.
 * Throws `LeadsConfigError` if the service account JSON env var is missing
 * or unparseable.
 */
export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const raw = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  if (!raw) {
    throw new LeadsConfigError(
      "GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set",
    );
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new LeadsConfigError(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON",
    );
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/** Read the sheet ID from env at call time. */
export function getSheetId(): string {
  const id = process.env["LEADS_SHEET_ID"];
  if (!id) {
    throw new LeadsConfigError(
      "LEADS_SHEET_ID environment variable is not set",
    );
  }
  return id;
}

/**
 * Returns true if the given email (case-insensitive) already exists in the
 * sheet's email column. Used to silently de-duplicate lead submissions.
 */
export async function findEmailInSheet(email: string): Promise<boolean> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const target = email.trim().toLowerCase();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: EMAIL_COLUMN_RANGE,
  });

  const values = res.data.values ?? [];
  for (const row of values) {
    const cell = row[0];
    if (typeof cell === "string" && cell.trim().toLowerCase() === target) {
      return true;
    }
  }
  return false;
}

/** Append a single lead row: [Timestamp ISO, Name, Email, Source]. */
export async function appendLeadRow(name: string, email: string): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: APPEND_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[timestamp, name, email, LEAD_SOURCE]],
    },
  });
}

/** Test-only: clear the memoised client so env changes are picked up. */
export function __resetSheetsClientForTests(): void {
  cachedClient = undefined;
}
