import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MealPlanner } from '@/lib/ai/meal-planner'

const requestSchema = z.object({
  budgetCents: z.number().int().positive(),
  days: z.number().int().min(1).max(14),
  householdSize: z.number().int().min(1).max(20),
  dietaryRestrictions: z.array(z.string()).default([]),
  preferences: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const planner = new MealPlanner()
    const result = await planner.generatePlan(parsed.data)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Meal plan generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate meal plan' },
      { status: 500 },
    )
  }
}
