'use server';

import { parseUserMessage } from '@/ai/flows/parse-user-message';
import { triageUserMessage } from '@/ai/flows/triage-user-message';
import { praiseAgent } from '@/ai/flows/praise-agent'; // Import the new Praise Agent
// Removed unused imports: generateSubAgentPrompts, summarizeAgentActions, respondToUser

/**
 * Handles incoming user messages, orchestrates a simplified workflow
 * for testing the Praise Agent, and returns the final response.
 *
 * This function acts as the central coordinator, simulating the interactions
 * and directly delegating to the Praise Agent.
 *
 * @param message The user's message content.
 * @param channel The channel the message was received from (e.g., 'chat', 'email', 'whatsapp', 'voice').
 * @returns A promise that resolves to the final response string for the user.
 */
export async function handleUserMessage(message: string, channel: 'email' | 'whatsapp' | 'voice' | 'chat'): Promise<string> {
  console.log(`Handling message from ${channel}: "${message}"`);

  try {
    // 1. Communication Agent (Initial Parsing) -> Executive Agent (Simplified)
    // Parse the raw message into structured data (intent, entities).
    console.log("Step 1: Parsing user message...");
    const parsedMessage = await parseUserMessage({ message, channel });
    console.log("Parsed Message:", parsedMessage);

    // 2. Executive Agent (Triage - Simplified)
    // Triage the request based on sentiment, spam, topic, etc.
    // Note: In this simplified test, we don't act on the triage result besides checking for spam.
    console.log("Step 2: Triaging user message...");
    const triageResult = await triageUserMessage({ message, channel });
    console.log("Triage Result:", triageResult);

    // If marked as spam, respond appropriately and exit.
    if (triageResult.isSpam) {
      console.log("Message identified as spam.");
      return "This message appears to be spam and has been discarded.";
    }

    // 3. Executive Agent (Direct Delegation to Praise Agent)
    // For testing, we bypass decomposition and directly call the Praise Agent.
    console.log("Step 3: Delegating directly to Praise Agent...");
    const praiseResult = await praiseAgent({ message: message }); // Use the original message for praise
    console.log("Praise Agent Result:", praiseResult);

    // Check if the Praise Agent returned a valid result and the praised message
    if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
        console.error("Praise Agent did not return a valid praised message. Result:", praiseResult);
        // Provide a more specific error message indicating the Praise Agent failed
        return "Sorry, the Praise Agent couldn't process the message correctly.";
    }

    // 4. Return Praise Agent's Response
    // The output from the Praise Agent is the final response in this test case.
    console.log("Step 4: Returning praised message to user.");
    return praiseResult.praisedMessage;

  } catch (error) {
    // Log the specific error for easier debugging
    console.error("Error caught in handleUserMessage:", error);
    // Provide a generic error response to the user
    return "Sorry, I encountered an internal error while processing your request. Please try again later.";
  }
}

// TODO: Restore the full multi-agent workflow (decomposition, sub-agent execution, summarization, final response generation) after testing.
// TODO: Implement actual sub-agent execution logic (`executeSubAgentTask`)
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.
