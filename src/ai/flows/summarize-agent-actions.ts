'use server';

/**
 * @fileOverview This file defines the summarizeAgentActionsFlow, which summarizes the actions taken by sub-agents
 * and the data they retrieved or processed, so that the final report to the user is concise,
 * informative, and easy to understand.
 *
 * - summarizeAgentActions - A function that handles the summarizing agent actions process.
 * - SummarizeAgentActionsInput - The input type for the summarizeAgentActions function.
 * - SummarizeAgentActionsOutput - The return type for the summarizeAgentActions function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SummarizeAgentActionsInputSchema = z.object({
  actions: z
    .string()
    .describe('The detailed actions taken by the sub-agents including data retrieved and processed.'),
});
export type SummarizeAgentActionsInput = z.infer<typeof SummarizeAgentActionsInputSchema>;

const SummarizeAgentActionsOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise and informative summary of the actions taken by the sub-agents.'),
});
export type SummarizeAgentActionsOutput = z.infer<typeof SummarizeAgentActionsOutputSchema>;

export async function summarizeAgentActions(input: SummarizeAgentActionsInput): Promise<SummarizeAgentActionsOutput> {
  return summarizeAgentActionsFlow(input);
}

const summarizeAgentActionsPrompt = ai.definePrompt({
  name: 'summarizeAgentActionsPrompt',
  input: {
    schema: z.object({
      actions: z
        .string()
        .describe('The detailed actions taken by the sub-agents including data retrieved and processed.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z
        .string()
        .describe('A concise and informative summary of the actions taken by the sub-agents.'),
    }),
  },
  prompt: `You are an expert at summarizing complex information into concise and easy-to-understand summaries.

  Please summarize the following actions taken by sub-agents, including the data they retrieved and processed, into a concise and informative summary:

  Actions: {{{actions}}}
  `,
});

const summarizeAgentActionsFlow = ai.defineFlow<
  typeof SummarizeAgentActionsInputSchema,
  typeof SummarizeAgentActionsOutputSchema
>({
  name: 'summarizeAgentActionsFlow',
  inputSchema: SummarizeAgentActionsInputSchema,
  outputSchema: SummarizeAgentActionsOutputSchema,
},
async input => {
  const {output} = await summarizeAgentActionsPrompt(input);
  return output!;
});
