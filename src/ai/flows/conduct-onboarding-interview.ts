'use server';
/**
 * @fileOverview Defines the Onboarding Interviewer Agent flow.
 * This agent simulates asking onboarding questions and generates the final structured data.
 *
 * - conductOnboardingInterview - Function to invoke the onboarding interview flow.
 * - ConductOnboardingInterviewInput - Input type (currently empty).
 * - ConductOnboardingInterviewOutput - Output type containing structured onboarding data.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Input schema (currently empty as it's just triggered)
const ConductOnboardingInterviewInputSchema = z.object({});
export type ConductOnboardingInterviewInput = z.infer<typeof ConductOnboardingInterviewInputSchema>;

// Output schema containing the structured onboarding data
const ConductOnboardingInterviewOutputSchema = z.object({
  onboardingData: z.object({
    name: z.string().describe("The user's name."),
    goal: z.string().describe("The user's goal for the 30-day trial."),
    channel: z.enum(['Chat', 'Email', 'Whatsapp']).describe("The user's preferred communication channel."),
  }).describe('The collected onboarding information.'),
});
export type ConductOnboardingInterviewOutput = z.infer<typeof ConductOnboardingInterviewOutputSchema>;

/**
 * Simulates the onboarding interview process in a single step.
 * Asks the required questions internally and generates example answers.
 * @param input - Currently an empty object.
 * @returns An object containing the simulated onboarding data.
 */
export async function conductOnboardingInterview(input: ConductOnboardingInterviewInput): Promise<ConductOnboardingInterviewOutput> {
  console.log("[conductOnboardingInterview] Invoked with input:", input);
  try {
    const result = await conductOnboardingInterviewFlow(input);
    console.log("[conductOnboardingInterview] Flow completed successfully. Result:", result);
    // Basic validation to ensure the structure is generally correct
    if (!result || !result.onboardingData || typeof result.onboardingData.name !== 'string') {
        throw new Error("Onboarding flow returned invalid data structure.");
    }
    return result;
  } catch (error) {
    console.error("[conductOnboardingInterview] Error executing flow:", error);
    if (error instanceof Error) {
        throw new Error(`Onboarding Interview failed: ${error.message}`);
    }
    throw new Error("Onboarding Interview failed with an unknown error.");
  }
}

// Define the prompt for the Onboarding Interviewer Agent
const onboardingInterviewPrompt = ai.definePrompt({
  name: 'onboardingInterviewPrompt',
  input: {
    schema: ConductOnboardingInterviewInputSchema, // Takes empty input for now
  },
  output: {
    schema: ConductOnboardingInterviewOutputSchema, // Expects the structured output
  },
  prompt: `You are an Onboarding Interviewer AI. Your task is to simulate asking a new user the following three questions and generate example answers for them:
1. What is your name?
2. What is your goal for the 30 day free trial?
3. What is your preferred channel of communication (Chat, Email, or Whatsapp)?

Generate plausible, example answers for these questions. For the channel, choose one of 'Chat', 'Email', or 'Whatsapp'.

Return the collected information ONLY as a valid JSON object conforming to the output schema, nested under the 'onboardingData' key. Do not include any other text, explanation, or conversational elements in your response.`,
});

// Define the Genkit flow for the Onboarding Interviewer Agent
const conductOnboardingInterviewFlow = ai.defineFlow<
  typeof ConductOnboardingInterviewInputSchema,
  typeof ConductOnboardingInterviewOutputSchema
>(
  {
    name: 'conductOnboardingInterviewFlow',
    inputSchema: ConductOnboardingInterviewInputSchema,
    outputSchema: ConductOnboardingInterviewOutputSchema,
  },
  async (input) => {
    console.log("[conductOnboardingInterviewFlow] Flow invoked with:", input);
    try {
        console.log("[conductOnboardingInterviewFlow] Calling onboardingInterviewPrompt...");
        const { output } = await onboardingInterviewPrompt(input);
        console.log("[conductOnboardingInterviewFlow] Prompt returned output:", output);

        if (!output) {
            console.error("[conductOnboardingInterviewFlow] Error: Prompt did not return an output.");
            throw new Error("Onboarding Interview prompt did not return an output.");
        }
         // Add validation for the nested structure
         if (!output.onboardingData || typeof output.onboardingData.name !== 'string' || typeof output.onboardingData.goal !== 'string' || !['Chat', 'Email', 'Whatsapp'].includes(output.onboardingData.channel) ) {
             console.error("[conductOnboardingInterviewFlow] Error: Prompt output is missing required fields or has incorrect types. Output:", output);
            throw new Error("Onboarding Interview prompt returned invalid output structure.");
        }
        console.log("[conductOnboardingInterviewFlow] Flow successful. Returning output:", output);
        return output;
    } catch (error) {
        console.error("[conductOnboardingInterviewFlow] Error during prompt execution:", error);
        if (error instanceof Error) {
             throw new Error(`Error in conductOnboardingInterviewFlow calling prompt: ${error.message}`);
        }
       throw new Error("Unknown error occurred within conductOnboardingInterviewFlow.");
    }
  }
);
