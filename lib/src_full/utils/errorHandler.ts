// Sentralisert feilhåndterings-modul
import { NextResponse } from 'next/server';

// Enum for feiltyper for enklere kategorisering
export enum ErrorType {
  AUTH = 'authentication',
  API = 'api',
  VALIDATION = 'validation',
  SERVER = 'server',
  CLIENT = 'client',
  NETWORK = 'network',
  JSON_PARSE = 'json_parse'  // Specific for JSON parse errors
}

// Grensesnitt for strukturert feilrapportering
interface ErrorReport {
  type: ErrorType;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  stack?: string;
}

// Logger feil til konsoll og eventuelt til backend
export function logError(
  error: Error | unknown, 
  type: ErrorType = ErrorType.SERVER, 
  context: Record<string, unknown> = {}
): void {
  const timestamp = new Date().toISOString();
  
  // Konvertere til strukturert feilobjekt
  const errorObj: ErrorReport = {
    type,
    message: error instanceof Error ? error.message : String(error),
    context,
    timestamp,
    stack: error instanceof Error ? error.stack : undefined
  };

  // Logg til konsoll
  console.error(`[${type}] Error:`, errorObj);

  // I produksjon kan vi også sende til en loggingstjeneste
  if (process.env.NODE_ENV === 'production') {
    try {
      // Send til backend-endepunkt
      fetch('/api/auth/_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorObj),
        // Vi bryr oss ikke om resultatet, dette er en fire-and-forget
        keepalive: true
      }).catch(() => {});
    } catch {
      // Ignorer feil ved logging - vi vil ikke at logging skal forårsake nye feil
    }
  }
}

// Standardisert API-feilhåndtering for API-ruter
export function handleApiError(error: Error | unknown, context: Record<string, unknown> = {}) {
  logError(error, ErrorType.API, context);
  
  return NextResponse.json(
    { 
      error: 'En feil oppstod under behandlingen av forespørselen', 
      success: false,
      timestamp: new Date().toISOString()
    },
    { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
}

// Sikker JSON parsing som aldri kaster feil
export function safeJsonParse(data: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (!data || typeof data !== 'string') {
    logError(
      new Error('Invalid input to safeJsonParse - not a string'), 
      ErrorType.JSON_PARSE, 
      { dataType: typeof data }
    );
    return fallback;
  }
  
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch (error) {
    // Check if the data looks like HTML (common when endpoints return error pages)
    const isHtml = data.trim().startsWith('<!DOCTYPE') || 
                  data.trim().startsWith('<html') || 
                  data.trim().includes('</html>') || 
                  data.trim().includes('<body');
                  
    logError(
      error, 
      ErrorType.JSON_PARSE, 
      { 
        isHtml, 
        dataPreview: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
        dataLength: data.length
      }
    );
    return fallback;
  }
}

// Function to handle a response that might be HTML instead of JSON
export async function safeJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const contentType = response.headers.get('content-type') || '';
    
    // If it's explicitly HTML, handle differently
    if (contentType.includes('text/html')) {
      const htmlText = await response.text();
      logError(
        new Error('Received HTML response when expecting JSON'), 
        ErrorType.JSON_PARSE, 
        { 
          contentType,
          url: response.url,
          status: response.status,
          htmlPreview: htmlText.substring(0, 200) + '...'
        }
      );
      return { error: 'Received HTML instead of JSON response', status: response.status };
    }
    
    // Try to parse as JSON first
    if (contentType.includes('application/json')) {
      return await response.json() as Record<string, unknown>;
    }
    
    // For other content types, try JSON first, then fallback to text
    try {
      return await response.json() as Record<string, unknown>;
    } catch {
      const text = await response.clone().text();
      // Try to manually parse the text as JSON
      return safeJsonParse(text, { 
        error: 'Invalid JSON response', 
        status: response.status,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });
    }
  } catch (error) {
    logError(error, ErrorType.JSON_PARSE, { 
      url: response.url,
      status: response.status,
      statusText: response.statusText
    });
    return { error: 'Failed to process response', status: response.status };
  }
}

// Funksjon for å teste om en respons er gyldig JSON
export async function isValidJsonResponse(response: Response): Promise<boolean> {
  try {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return false;
    }
    
    // Vi må klone responsen for å kunne lese den uten å konsumere den
    const clone = response.clone();
    const text = await clone.text();
    
    // Check for HTML content mistakenly sent with JSON content type
    if (text.trim().startsWith('<!DOCTYPE') || 
        text.trim().startsWith('<html') ||
        text.trim().includes('</html>')) {
      return false;
    }
    
    JSON.parse(text); // This will throw if not valid JSON
    return true;
  } catch {
    return false;
  }
}

// Funksjon for å håndtere nettverksfeil på klientsiden
export function handleNetworkError(error: Error) {
  logError(error, ErrorType.NETWORK);
  
  // Returner en brukervennlig feilmelding
  return {
    error: 'Kunne ikke koble til serveren. Sjekk nettverkstilkoblingen din.',
    isNetworkError: true
  };
}

// Hjelpefunksjon for å validere input
export function validateInput<T>(input: T, validator: (input: T) => boolean, errorMessage: string): T {
  if (!validator(input)) {
    const error = new Error(errorMessage);
    logError(error, ErrorType.VALIDATION, { input });
    throw error;
  }
  return input;
}

// Special function to handle NextAuth session fetching errors
export async function fetchWithErrorHandling(url: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });

    // Check for response errors
    if (!response.ok) {
      // Try to get error details from the response
      const errorDetails = await safeJsonResponse(response);
      throw new Error(`Request failed with status ${response.status}: ${JSON.stringify(errorDetails)}`);
    }

    // Process response safely
    return await safeJsonResponse(response);
  } catch (error) {
    // Determine if it's a network error or server error
    const isNetworkIssue = error instanceof Error && 
      (error.message.includes('fetch failed') || 
       error.message.includes('network') || 
       error.message.includes('Failed to fetch'));
    
    logError(error, isNetworkIssue ? ErrorType.NETWORK : ErrorType.API, { url });
    
    throw error; // Re-throw to allow calling code to handle it
  }
}

// Helper to check if a string is likely HTML content
export function isLikelyHtml(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('</html>') ||
    trimmed.includes('<head>') ||
    trimmed.includes('<body')
  );
}

// Helper for debugging JSON parse errors - can be called when you suspect issues
export function debugJsonParseIssue(data: string): { 
  isLikelyHtml: boolean, 
  firstChars: string,
  length: number,
  containsJsonStart: boolean
} {
  return {
    isLikelyHtml: isLikelyHtml(data),
    firstChars: data.substring(0, 50),
    length: data.length,
    containsJsonStart: data.trim().startsWith('{') || data.trim().startsWith('[')
  };
}