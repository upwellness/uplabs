/**
 * BFF — Classification endpoint
 * Given a measurement, return all status levels in one call.
 * Keeps clinical thresholds server-side so they can be versioned/audited.
 */

import { NextResponse } from "next/server";
import {
  classifyBodyFat,
  classifyMusclePct,
  classifyVisceralFat,
  classifyBMI,
  classifyBodyAge,
} from "@/lib/medical-status";

export async function POST(req: Request) {
  try {
    const { gender, weight, height, fat_pct, muscle_pct, visceral, body_age, chrono_age } = await req.json();

    const bmi = weight && height ? weight / ((height / 100) ** 2) : null;

    const result = {
      bmi:        bmi != null ? { value: +bmi.toFixed(1), level: classifyBMI(bmi) } : null,
      fat:        fat_pct != null && gender ? { value: fat_pct, level: classifyBodyFat(fat_pct, gender) } : null,
      muscle:     muscle_pct != null && gender ? { value: muscle_pct, level: classifyMusclePct(muscle_pct, gender) } : null,
      visceral:   visceral != null ? { value: visceral, level: classifyVisceralFat(visceral) } : null,
      body_age:   body_age != null && chrono_age != null ? { value: body_age, level: classifyBodyAge(body_age, chrono_age) } : null,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
