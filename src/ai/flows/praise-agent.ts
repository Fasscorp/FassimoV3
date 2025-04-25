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
  return praiseAgentFlow(input);
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

Return the modified message in the 'praisedMessage' field.`,
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
    console.log("Praise Agent Flow invoked with:", input);
    const { output } = await praiseAgentPrompt(input);
    console.log("Praise Agent Flow output:", output);
    if (!output) {
        throw new Error("Praise Agent did not return an output.");
    }
    return output;
  }
);
