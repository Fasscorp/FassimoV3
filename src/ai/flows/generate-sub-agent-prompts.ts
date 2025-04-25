'use server';
/**
 * @fileOverview This file defines the Genkit flow for generating optimized prompts for sub-agents.
 *
 * - generateSubAgentPrompts - A function that generates prompts for sub-agents.
 * - GenerateSubAgentPromptsInput - The input type for the generateSubAgentPrompts function.
 * - GenerateSubAgentPromptsOutput - The return type for the generateSubAgentPrompts function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateSubAgentPromptsInputSchema = z.object({
  userRequest: z.string().describe('The user request to be processed.'),
  availableData: z.string().describe('Data available to the sub-agents.'),
  subAgentCapabilities: z.string().describe('Capabilities of the sub-agents.'),
});
export type GenerateSubAgentPromptsInput = z.infer<typeof GenerateSubAgentPromptsInputSchema>;

const GenerateSubAgentPromptsOutputSchema = z.object({
  prompts: z.record(z.string(), z.string()).describe('Prompts for each sub-agent.'),
});
export type GenerateSubAgentPromptsOutput = z.infer<typeof GenerateSubAgentPromptsOutputSchema>;

export async function generateSubAgentPrompts(input: GenerateSubAgentPromptsInput): Promise<GenerateSubAgentPromptsOutput> {
  return generateSubAgentPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSubAgentPromptsPrompt',
  input: {
    schema: z.object({
      userRequest: z.string().describe('The user request to be processed.'),
      availableData: z.string().describe('Data available to the sub-agents.'),
      subAgentCapabilities: z.string().describe('Capabilities of the sub-agents.'),
    }),
  },
  output: {
    schema: z.object({
      prompts: z.record(z.string(), z.string()).describe('Prompts for each sub-agent.'),
    }),
  },
  prompt: `You are an expert prompt engineer. Based on the user request, the available data, and the sub-agent capabilities, generate optimized prompts for each sub-agent.

User Request: {{{userRequest}}}
Available Data: {{{availableData}}}
Sub-Agent Capabilities: {{{subAgentCapabilities}}}

Return a JSON object where the keys are the sub-agent names and the values are the prompts.`,
});

const generateSubAgentPromptsFlow = ai.defineFlow<
  typeof GenerateSubAgentPromptsInputSchema,
  typeof GenerateSubAgentPromptsOutputSchema
>(
  {
    name: 'generateSubAgentPromptsFlow',
    inputSchema: GenerateSubAgentPromptsInputSchema,
    outputSchema: GenerateSubAgentPromptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
