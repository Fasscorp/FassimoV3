'use server';
/**
 * @fileOverview Parses user messages to extract intent and entities.
 *
 * - parseUserMessage - A function that parses user messages and converts them to structured format.
 * - ParseUserMessageInput - The input type for the parseUserMessage function.
 * - ParseUserMessageOutput - The return type for the parseUserMessage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ParseUserMessageInputSchema = z.object({
  message: z.string().describe('The user message to parse.'),
  channel: z.enum(['email', 'whatsapp', 'voice', 'chat']).describe('The channel the message was received from.'),
});
export type ParseUserMessageInput = z.infer<typeof ParseUserMessageInputSchema>;

const ParseUserMessageOutputSchema = z.object({
  intent: z.string().describe('The intent of the user message.'),
  entities: z.record(z.string(), z.any()).describe('The entities extracted from the user message. Should be an empty object {} if no entities are found.'),
  channel: z.enum(['email', 'whatsapp', 'voice', 'chat']).describe('The channel the message was received from.'),
});
export type ParseUserMessageOutput = z.infer<typeof ParseUserMessageOutputSchema>;

export async function parseUserMessage(input: ParseUserMessageInput): Promise<ParseUserMessageOutput> {
  return parseUserMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseUserMessagePrompt',
  input: {
    schema: z.object({
      message: z.string().describe('The user message to parse.'),
      channel: z.string().describe('The channel the message was received from.'),
    }),
  },
  output: {
    schema: z.object({
      intent: z.string().describe('The intent of the user message.'),
      entities: z.record(z.string(), z.any()).describe('The entities extracted from the user message. Should be an empty object {} if no entities are found.'),
      channel: z.enum(['email', 'whatsapp', 'voice', 'chat']).describe('The channel the message was received from.'),
    }),
  },
  prompt: `You are an AI assistant that parses user messages to understand their intent and extract key entities. The message was sent from channel {{{channel}}}.

Message: {{{message}}}

Identify the intent of the message and extract any relevant entities. Return the intent and entities in JSON format. Make the entities easy to process by a computer. Always include the channel in the output. If no entities are found, return an empty JSON object ({}) for the 'entities' field.
  `,
});

const parseUserMessageFlow = ai.defineFlow<
  typeof ParseUserMessageInputSchema,
  typeof ParseUserMessageOutputSchema
>(
  {
    name: 'parseUserMessageFlow',
    inputSchema: ParseUserMessageInputSchema,
    outputSchema: ParseUserMessageOutputSchema,
  },
  async input => {
    console.log("[parseUserMessageFlow] Invoked with input:", input);
    try {
        const {output} = await prompt(input);
        console.log("[parseUserMessageFlow] Prompt successful. Output:", output);
        if (!output) {
            console.error("[parseUserMessageFlow] Error: Prompt did not return an output.");
            throw new Error("Parse User Message prompt failed to return an output.");
        }
         // Add a check to ensure entities is an object, even if empty
        if (typeof output.entities !== 'object' || output.entities === null) {
           console.warn("[parseUserMessageFlow] Warning: Entities field is not an object. Defaulting to empty object. Original output:", output);
           output.entities = {};
        }
        return output;
    } catch (error) {
        console.error("[parseUserMessageFlow] Error executing prompt:", error);
         if (error instanceof Error) {
             throw new Error(`Error in parseUserMessageFlow calling prompt: ${error.message}`);
         }
        throw new Error("Unknown error occurred within parseUserMessageFlow.");
    }
  }
);
