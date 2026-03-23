import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message: "Self-registration is disabled. Contact your administrator to create an account.",
    },
    { status: 403 }
  );
}
