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
  console.log(`[handleUserMessage] Handling message from ${channel}: "${message}"`);

  try {
    // 1. Communication Agent (Initial Parsing) -> Executive Agent (Simplified)
    console.log("[handleUserMessage] Step 1: Calling parseUserMessage...");
    const parsedMessage = await parseUserMessage({ message, channel });
    console.log("[handleUserMessage] Step 1: parseUserMessage successful. Result:", parsedMessage);

    // 2. Executive Agent (Triage - Simplified)
    console.log("[handleUserMessage] Step 2: Calling triageUserMessage...");
    const triageResult = await triageUserMessage({ message, channel });
    console.log("[handleUserMessage] Step 2: triageUserMessage successful. Result:", triageResult);

    // If marked as spam, respond appropriately and exit.
    if (triageResult.isSpam) {
      console.log("[handleUserMessage] Message identified as spam.");
      return "This message appears to be spam and has been discarded.";
    }

    // 3. Executive Agent (Direct Delegation to Praise Agent)
    console.log("[handleUserMessage] Step 3: Calling praiseAgent...");
    const praiseResult = await praiseAgent({ message: message });
    console.log("[handleUserMessage] Step 3: praiseAgent successful. Result:", praiseResult);

    // Check if the Praise Agent returned a valid result and the praised message
    if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
        console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
        // Return a more specific error message
        return "Sorry, the Praise Agent couldn't process the message correctly due to an invalid response structure.";
    }

    // 4. Return Praise Agent's Response
    console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
    return praiseResult.praisedMessage;

  } catch (error: any) {
    // Log the specific error for easier debugging
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    // Provide a generic error response to the user
    return `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${error.message || 'Unknown error'})`;
  }
}

// TODO: Restore the full multi-agent workflow (decomposition, sub-agent execution, summarization, final response generation) after testing.
// TODO: Implement actual sub-agent execution logic (`executeSubAgentTask`)
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.