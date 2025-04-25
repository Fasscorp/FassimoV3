// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview This file defines a Genkit flow for the Communication Agent to generate human-sounding responses to users.
 *
 * - respondToUser - A function that orchestrates the response generation process.
 * - RespondToUserInput - The input type for the respondToUser function.
 * - RespondToUserOutput - The return type for the respondToUser function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const RespondToUserInputSchema = z.object({
  summary: z.string().describe('A summary of the actions taken by the system.'),
});

export type RespondToUserInput = z.infer<typeof RespondToUserInputSchema>;

const RespondToUserOutputSchema = z.object({
  response: z.string().describe('The human-sounding response to the user.'),
});

export type RespondToUserOutput = z.infer<typeof RespondToUserOutputSchema>;

export async function respondToUser(input: RespondToUserInput): Promise<RespondToUserOutput> {
  return respondToUserFlow(input);
}

const prompt = ai.definePrompt({
  name: 'respondToUserPrompt',
  input: {
    schema: z.object({
      summary: z.string().describe('A summary of the actions taken by the system.'),
    }),
  },
  output: {
    schema: z.object({
      response: z.string().describe('The human-sounding response to the user.'),
    }),
  },
  prompt: `You are a helpful AI assistant. Generate a human-sounding response to the user based on the following summary of actions taken:\n\nSummary: {{{summary}}}\n\nResponse:`, // Ensure the prompt asks for a response
});

const respondToUserFlow = ai.defineFlow<
  typeof RespondToUserInputSchema,
  typeof RespondToUserOutputSchema
>({
  name: 'respondToUserFlow',
  inputSchema: RespondToUserInputSchema,
  outputSchema: RespondToUserOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
