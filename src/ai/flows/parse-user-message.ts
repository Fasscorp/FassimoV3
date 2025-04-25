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

// Updated schema: Defined an optional property to satisfy API requirement for non-empty properties in object type.
const ParseUserMessageOutputSchema = z.object({
  intent: z.string().describe('The intent of the user message.'),
  entities: z.object({
      // Adding an optional property to satisfy the API's requirement
      // that object schemas must define properties.
      extractedValue: z.string().optional().describe("A generic placeholder for any extracted entity value. Omit this field entirely if no specific entities are found.")
  }).describe('The entities extracted from the user message. Returns an object that might contain specific extracted key-value pairs. If no entities are found, it might be an empty object, but the schema requires defining potential properties.'),
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
    // Updated output schema to match the change in ParseUserMessageOutputSchema
    schema: z.object({
      intent: z.string().describe('The intent of the user message.'),
       entities: z.object({
           extractedValue: z.string().optional().describe("A generic placeholder for any extracted entity value. Omit this field entirely if no specific entities are found.")
       }).describe('The entities extracted from the user message. Returns an object that might contain specific extracted key-value pairs. If no entities are found, it might be an empty object, but the schema requires defining potential properties.'),
      channel: z.enum(['email', 'whatsapp', 'voice', 'chat']).describe('The channel the message was received from.'),
    }),
  },
  // Keep the instruction for the LLM to return an empty object if no entities found.
  // The schema change is primarily for API compatibility.
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
        console.log("[parseUserMessageFlow] Prompt successful. Raw Output:", output);
        if (!output) {
            console.error("[parseUserMessageFlow] Error: Prompt did not return an output.");
            throw new Error("Parse User Message prompt failed to return an output.");
        }
         // Add a check to ensure entities is an object, even if empty. Handles cases where LLM might still return null/undefined despite prompt.
        if (typeof output.entities !== 'object' || output.entities === null) {
           console.warn("[parseUserMessageFlow] Warning: Entities field is not an object or is null. Defaulting to empty object. Original output:", output);
           output.entities = {}; // Ensure it's at least an empty object.
        }
        console.log("[parseUserMessageFlow] Processed Output:", output);
        return output;
    } catch (error) {
        console.error("[parseUserMessageFlow] Error executing prompt:", error);
         if (error instanceof Error) {
             // Include more context in the thrown error
             throw new Error(`Error in parseUserMessageFlow calling prompt: ${error.message}. Input was: ${JSON.stringify(input)}`);
         }
        throw new Error("Unknown error occurred within parseUserMessageFlow.");
    }
  }
);
