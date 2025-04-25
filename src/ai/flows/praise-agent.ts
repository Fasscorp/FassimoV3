'use server';
/**
 * @fileOverview Defines the Praise Agent flow.
 * This agent takes a message and adds enthusiastic praise around it.
 *
 * - praiseAgent - Function to invoke the praise agent flow.
 * - PraiseAgentInput - Input type for the praiseAgent function.
 * - PraiseAgentOutput - Output type for the praiseAgent function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the input schema for the Praise Agent
const PraiseAgentInputSchema = z.object({
  message: z.string().describe('The message to be praised.'),
});
export type PraiseAgentInput = z.infer<typeof PraiseAgentInputSchema>;

// Define the output schema for the Praise Agent
const PraiseAgentOutputSchema = z.object({
  praisedMessage: z.string().describe('The message with praise added.'),
});
export type PraiseAgentOutput = z.infer<typeof PraiseAgentOutputSchema>;

/**
 * Wraps the input message with enthusiastic praise.
 * @param input The message to praise.
 * @returns The praised message.
 */
export async function praiseAgent(input: PraiseAgentInput): Promise<PraiseAgentOutput> {
  console.log("[praiseAgent] Invoked with input:", input);
  try {
    const result = await praiseAgentFlow(input);
    console.log("[praiseAgent] Flow completed successfully. Result:", result);
    return result;
  } catch (error) {
    console.error("[praiseAgent] Error executing praiseAgentFlow:", error);
    // Re-throw the error so it can be caught by the caller (handleUserMessage)
    // but add context if possible.
    if (error instanceof Error) {
        throw new Error(`Praise Agent failed: ${error.message}`);
    }
    throw new Error("Praise Agent failed with an unknown error.");
  }
}

// Define the prompt for the Praise Agent
const praiseAgentPrompt = ai.definePrompt({
  name: 'praiseAgentPrompt',
  input: {
    schema: PraiseAgentInputSchema,
  },
  output: {
    schema: PraiseAgentOutputSchema,
  },
  prompt: `Take the following message and add "!!!THIS IS AMAZING!!!" exactly as written to the beginning and end of it. Do not add any other text or explanation.

Message: {{{message}}}

Return the modified message in the 'praisedMessage' field of the JSON output. Ensure the output is valid JSON conforming to the schema.`,
});

// Define the Genkit flow for the Praise Agent
const praiseAgentFlow = ai.defineFlow<
  typeof PraiseAgentInputSchema,
  typeof PraiseAgentOutputSchema
>(
  {
    name: 'praiseAgentFlow',
    inputSchema: PraiseAgentInputSchema,
    outputSchema: PraiseAgentOutputSchema,
  },
  async (input) => {
    console.log("[praiseAgentFlow] Flow invoked with:", input);
    try {
        console.log("[praiseAgentFlow] Calling praiseAgentPrompt...");
        const { output } = await praiseAgentPrompt(input);
        console.log("[praiseAgentFlow] praiseAgentPrompt returned output:", output);

        if (!output) {
            console.error("[praiseAgentFlow] Error: praiseAgentPrompt did not return an output.");
            throw new Error("Praise Agent prompt did not return an output.");
        }
         if (typeof output.praisedMessage !== 'string') {
             console.error("[praiseAgentFlow] Error: praiseAgentPrompt output is missing 'praisedMessage' or it's not a string. Output:", output);
            throw new Error("Praise Agent prompt returned invalid output structure.");
        }
        console.log("[praiseAgentFlow] Flow successful. Returning output:", output);
        return output;
    } catch (error) {
        console.error("[praiseAgentFlow] Error during prompt execution:", error);
        // Re-throw the error to be caught by the calling function (praiseAgent)
        if (error instanceof Error) {
             throw new Error(`Error in praiseAgentFlow calling prompt: ${error.message}`);
        }
       throw new Error("Unknown error occurred within praiseAgentFlow.");
    }
  }
);