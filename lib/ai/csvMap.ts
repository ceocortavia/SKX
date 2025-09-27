export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ROLE_KEYWORDS = ['role', 'rolle', 'access', 'permission'];
const NAME_KEYWORDS = ['name', 'navn', 'full name', 'fullname'];

export const VALID_ROLES = new Set(['owner', 'admin', 'member']);

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface CsvMappingResult {
  mapping: {
    name?: string;
    email?: string;
    role?: string;
  };
  issues: string[];
  confidenceByField: Record<string, number>;
}

interface SampleRow {
  [key: string]: string | null | undefined;
}

export function collectIssues(mapping: CsvMappingResult['mapping'], sampleRows: SampleRow[]): string[] {
  const issues: string[] = [];
  const emailColumn = mapping.email ? sampleRows.map((row) => row?.[mapping.email!]).filter(Boolean) as string[] : [];
  if (!mapping.email) {
    issues.push('Fant ingen kolonne som ser ut som e-post');
  } else {
    const duplicates = new Map<string, number>();
    emailColumn.forEach((value) => {
      const normalized = String(value).toLowerCase().trim();
      if (!EMAIL_REGEX.test(normalized)) return;
      duplicates.set(normalized, (duplicates.get(normalized) ?? 0) + 1);
    });
    const realDuplicates = Array.from(duplicates.values()).filter((count) => count > 1).length;
    if (realDuplicates > 0) {
      issues.push(`${realDuplicates} duplikate e-postadresser i eksemplene`);
    }

    const missingEmailRows = sampleRows.filter((row) => {
      const value = row?.[mapping.email!];
      return !value || !String(value).trim();
    }).length;
    if (missingEmailRows > 0) {
      issues.push(`${missingEmailRows} rader mangler e-post`);
    }

    const invalidEmailRows = sampleRows.filter((row) => {
      const value = row?.[mapping.email!];
      return value && !EMAIL_REGEX.test(String(value));
    }).length;
    if (invalidEmailRows > 0) {
      issues.push(`${invalidEmailRows} rader har ugyldig e-postformat`);
    }
  }

  if (mapping.role) {
    const invalidRoles = new Map<string, number>();
    sampleRows.forEach((row) => {
      const value = row?.[mapping.role!];
      if (!value) return;
      const normalized = String(value).toLowerCase().trim();
      if (!VALID_ROLES.has(normalized)) {
        invalidRoles.set(normalized, (invalidRoles.get(normalized) ?? 0) + 1);
      }
    });
    invalidRoles.forEach((count, value) => {
      issues.push(`${count} ugyldig rolleverdi: '${value}'`);
    });
  }

  return issues;
}

export function analyzeCsvMapping(headers: string[], sampleRows: SampleRow[]): CsvMappingResult {
  const mapping: CsvMappingResult['mapping'] = {};
  const confidence: Record<string, number> = {};

  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  const headerLookup = new Map<string, string>();
  normalizedHeaders.forEach((norm, index) => {
    headerLookup.set(norm, headers[index]);
  });

  // Email detection
  headers.forEach((header, index) => {
    const norm = normalizedHeaders[index];
    if (mapping.email) return;
    if (norm.includes('email') || norm.includes('e-post') || norm.includes('epost')) {
      mapping.email = header;
      confidence.email = 0.99;
    }
  });

  if (!mapping.email) {
    headers.forEach((header, index) => {
      const norm = normalizedHeaders[index];
      if (mapping.email) return;
      const columnValues = sampleRows.map((row) => row?.[header]).filter(Boolean) as string[];
      const emailMatches = columnValues.filter((value) => EMAIL_REGEX.test(String(value ?? '')));
      if (emailMatches.length >= Math.max(1, columnValues.length / 2)) {
        mapping.email = header;
        confidence.email = 0.85;
      }
    });
  }

  // Name detection
  headers.forEach((header, index) => {
    if (mapping.name) return;
    const norm = normalizedHeaders[index];
    if (NAME_KEYWORDS.some((keyword) => norm.includes(keyword))) {
      mapping.name = header;
      confidence.name = 0.9;
    }
  });

  if (!mapping.name) {
    headers.forEach((header) => {
      if (mapping.name) return;
      const values = sampleRows.map((row) => row?.[header]).filter(Boolean) as string[];
      const hasSpace = values.filter((value) => value.trim().includes(' ')).length;
      if (hasSpace >= Math.max(1, values.length / 2)) {
        mapping.name = header;
        confidence.name = 0.6;
      }
    });
  }

  // Role detection
  headers.forEach((header, index) => {
    if (mapping.role) return;
    const norm = normalizedHeaders[index];
    if (ROLE_KEYWORDS.some((keyword) => norm.includes(keyword))) {
      mapping.role = header;
      confidence.role = 0.8;
    }
  });

  if (!mapping.role) {
    headers.forEach((header) => {
      if (mapping.role) return;
      const values = sampleRows.map((row) => row?.[header]).filter(Boolean) as string[];
      const normalized = values.map((value) => String(value).toLowerCase().trim());
      const matchCount = normalized.filter((value) => VALID_ROLES.has(value)).length;
      if (matchCount >= Math.max(1, values.length / 3)) {
        mapping.role = header;
        confidence.role = 0.55;
      }
    });
  }

  // Issues: duplicates or missing essential fields
  const issues = collectIssues(mapping, sampleRows);

  return {
    mapping,
    issues,
    confidenceByField: confidence,
  };
}
