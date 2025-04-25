'use server';
/**
 * @fileOverview Triage User Message Flow
 *
 * This flow uses GenAI to classify incoming user requests based on sentiment analysis, spam detection, and topic classification.
 * It routes requests to the correct agents and prioritizes tasks accordingly.
 *
 * - triageUserMessage - A function that handles the triage process.
 * - TriageUserInput - The input type for the triageUserMessage function.
 * - TriageUserOutput - The return type for the triageUserMessage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const TriageUserInputSchema = z.object({
  message: z.string().describe('The user message to triage.'),
  channel: z.string().describe('The channel the message was sent from (e.g., email, whatsapp, chat).'),
});
export type TriageUserInput = z.infer<typeof TriageUserInputSchema>;

const TriageUserOutputSchema = z.object({
  sentiment: z.string().describe('The sentiment of the message (e.g., positive, negative, neutral).'),
  isSpam: z.boolean().describe('Whether the message is spam or not.'),
  topic: z.string().describe('The topic of the message (e.g., help, sales, support).'),
  priority: z.string().describe('The priority of the message (e.g., high, medium, low).'),
  routeToAgent: z.string().describe('The agent the message should be routed to.'),
});
export type TriageUserOutput = z.infer<typeof TriageUserOutputSchema>;

export async function triageUserMessage(input: TriageUserInput): Promise<TriageUserOutput> {
  return triageUserMessageFlow(input);
}

const triagePrompt = ai.definePrompt({
  name: 'triagePrompt',
  input: {
    schema: z.object({
      message: z.string().describe('The user message to triage.'),
      channel: z.string().describe('The channel the message was sent from (e.g., email, whatsapp, chat).'),
    }),
  },
  output: {
    schema: z.object({
      sentiment: z.string().describe('The sentiment of the message (e.g., positive, negative, neutral).'),
      isSpam: z.boolean().describe('Whether the message is spam or not.'),
      topic: z.string().describe('The topic of the message (e.g., help, sales, support).'),
      priority: z.string().describe('The priority of the message (e.g., high, medium, low).'),
      routeToAgent: z.string().describe('The agent the message should be routed to.'),
    }),
  },
  prompt: `You are an AI assistant that triages user messages to route them to the correct agent and prioritize tasks.

Analyze the following message and determine its sentiment, whether it is spam, its topic, its priority, and which agent it should be routed to. Return as a json.

Message: {{{message}}}
Channel: {{{channel}}}

Consider these agents:
- Customer Support
- Sales
- Technical Support

Return your answer as a JSON object with the following keys:
- sentiment (positive, negative, or neutral)
- isSpam (true or false)
- topic (help, sales, support, or other)
- priority (high, medium, or low)
- routeToAgent (Customer Support, Sales, or Technical Support)
`,
});

const triageUserMessageFlow = ai.defineFlow<
  typeof TriageUserInputSchema,
  typeof TriageUserOutputSchema
>(
  {
    name: 'triageUserMessageFlow',
    inputSchema: TriageUserInputSchema,
    outputSchema: TriageUserOutputSchema,
  },
  async input => {
    const {output} = await triagePrompt(input);
    return output!;
  }
);
