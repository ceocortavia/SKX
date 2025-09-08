import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ 
      status: "ok", 
      message: "API fungerer",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json({ 
      status: "error", 
      message: "Noe gikk galt med API-testen",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}