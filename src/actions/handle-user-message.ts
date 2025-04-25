
'use server';

import { parseUserMessage } from '@/ai/flows/parse-user-message';
import { triageUserMessage } from '@/ai/flows/triage-user-message';
import { praiseAgent } from '@/ai/flows/praise-agent';
import { conductOnboardingInterview, type Message as OnboardingMessage, type OnboardingData } from '@/ai/flows/conduct-onboarding-interview';
import { addTask } from '@/ai/flows/task-management/add-task'; // Import add task flow
import { getTasks } from '@/ai/flows/task-management/get-tasks'; // Import get tasks flow
import { z } from 'zod'; // Import zod for schema validation
import { addDays, formatISO } from 'date-fns'; // For date calculation


// Define the specific trigger messages
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';
const CREATE_PRODUCT_TRIGGER = 'START_CREATE_PRODUCT'; // Placeholder for future feature
const RESET_CONVERSATION_TRIGGER = 'RESET_CONVERSATION'; // Trigger for resetting
const VIEW_TASKLIST_TRIGGER = 'VIEW_TASKLIST'; // Trigger for viewing task list

// --- State Management (Simple Example - In-memory for this request) ---
// In a real application, this state should be stored persistently (e.g., Firestore, session storage)
interface ConversationState {
  currentFlow: 'onboarding' | 'praise' | 'create_product' | 'view_tasks' | null; // Added 'view_tasks'
  history: OnboardingMessage[];
  tasks: Array<{ id: string; description: string; priority: 'high' | 'medium' | 'low'; dueDate?: string; completed: boolean }>; // Add tasks to state
  // Add other state variables as needed, e.g., userId
}

// WARNING: This in-memory state is NOT suitable for production.
// It will be lost on server restarts and won't work across multiple users or sessions.
// Use a database or session store for real applications.
let conversationState: ConversationState = {
    currentFlow: null,
    history: [],
    tasks: [], // Initialize tasks array
};

// Helper function to reset the state
function resetConversationState() {
    console.log("[resetConversationState] Resetting state.");
    conversationState = {
        currentFlow: null,
        history: [],
        tasks: [], // Reset tasks too
    };
}


// Helper function to add messages to the state
function addMessageToHistory(sender: OnboardingMessage['sender'], text: string) {
    // Prevent adding reset/tasklist triggers to history if they just initiate the action
    if (text === RESET_CONVERSATION_TRIGGER || text === VIEW_TASKLIST_TRIGGER) return;
    const newMessage: OnboardingMessage = { sender, text };
    conversationState.history.push(newMessage);
    console.log("[addMessageToHistory] Updated history:", JSON.stringify(conversationState.history, null, 2)); // Log history clearly
}

// --- Task Management Helpers (Using Genkit Flows) ---

async function createOnboardingTask(onboardingData: OnboardingData) {
    let taskDescription = '';
    let taskPriority: 'high' | 'medium' | 'low' = 'medium';
    let dueDate: string | undefined = undefined;

    if (onboardingData.hasStripe === false) {
        taskDescription = 'Create a Stripe account for payment processing.';
        taskPriority = 'high';
        // Set due date 5 days from now
        const futureDate = addDays(new Date(), 5);
        dueDate = formatISO(futureDate); // Format as YYYY-MM-DDTHH:mm:ss.sssZ
        console.log(`[createOnboardingTask] Stripe task due date: ${dueDate}`);
    } else if (onboardingData.hasStripe === true) {
        taskDescription = 'Connect your Stripe account in Settings > Payments.';
        taskPriority = 'medium';
        // Optionally set a shorter due date or none
        // dueDate = formatISO(addDays(new Date(), 2));
    } else {
        // Should not happen if validation is correct, but handle gracefully
        console.warn("[createOnboardingTask] hasStripe is undefined, skipping task creation.");
        return;
    }

    try {
        console.log(`[createOnboardingTask] Adding task: "${taskDescription}", Priority: ${taskPriority}, Due: ${dueDate || 'None'}`);
        const addTaskInput = {
            description: taskDescription,
            priority: taskPriority,
            dueDate: dueDate,
        };
        const addedTask = await addTask(addTaskInput); // Assuming addTask returns the created task with an ID
        console.log("[createOnboardingTask] Task added successfully via Genkit flow:", addedTask);

        // Update local state (replace with persistent storage update in real app)
        // Note: The Genkit flow currently doesn't return the ID, so we'll mock it.
        // In a real app, the flow should return the ID from the database.
        const newTask = {
            id: addedTask.taskId || `temp-${Date.now()}`, // Use returned ID or mock
            description: taskDescription,
            priority: taskPriority,
            dueDate: dueDate,
            completed: false,
        };
        conversationState.tasks.push(newTask);
        console.log("[createOnboardingTask] Updated local tasks state:", conversationState.tasks);


    } catch (error) {
        console.error("[createOnboardingTask] Error adding task via Genkit flow:", error);
        // Handle error appropriately (e.g., notify user, log)
    }
}

async function fetchAndFormatTasks(): Promise<string> {
    try {
        console.log("[fetchAndFormatTasks] Fetching tasks via Genkit flow...");
        // Assuming getTasks takes no input for fetching all tasks for the user context
        // In a real app, you'd pass userId or similar identifier.
        const tasksResult = await getTasks({}); // Modify input if getTasks requires it
        console.log("[fetchAndFormatTasks] Tasks received from Genkit flow:", tasksResult);

        // Update local state (replace with persistent storage logic)
        // This assumes the flow returns the full list
        conversationState.tasks = tasksResult.tasks.map(t => ({
             id: t.id,
             description: t.description,
             priority: t.priority,
             dueDate: t.dueDate,
             completed: t.completed,
        }));


        if (!conversationState.tasks || conversationState.tasks.length === 0) {
            return "You have no pending tasks.";
        }

        // Format the tasks for display
        let taskListString = "Here is your current task list:\n\n";
        conversationState.tasks.forEach((task, index) => {
            taskListString += `${index + 1}. ${task.description}`;
            taskListString += `\n   - Priority: ${task.priority}`;
            if (task.dueDate) {
                try {
                 // Attempt to format the date nicely
                 const date = new Date(task.dueDate);
                 taskListString += `\n   - Due: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                } catch (e) {
                 taskListString += `\n   - Due: ${task.dueDate}`; // Fallback to raw string if parsing fails
                }
            }
            taskListString += `\n   - Status: ${task.completed ? 'Completed' : 'Pending'}`;
            // TODO: Add actions (buttons) to mark as complete later
            taskListString += `\n\n`;
        });

        return taskListString.trim();

    } catch (error) {
        console.error("[fetchAndFormatTasks] Error fetching or formatting tasks:", error);
        return "Sorry, I couldn't retrieve your task list at the moment.";
    }
}


// Interface for the response sent back to the UI
interface HandleUserMessageResponse {
    responseText: string;
    actions?: Array<{ label: string; trigger: string }>;
}


/**
 * Handles incoming user messages, manages conversation state, orchestrates agent interactions,
 * and routes to the appropriate flow based on the message content and state.
 *
 * @param message The user's message content or a special trigger.
 * @param channel The channel the message was received from (currently only 'chat' is fully handled).
 * @returns A promise that resolves to the final response object for the UI.
 */
export async function handleUserMessage(message: string, channel: 'email' | 'whatsapp' | 'voice' | 'chat'): Promise<HandleUserMessageResponse> {
  console.log(`[handleUserMessage] Handling message from ${channel}: "${message}"`);
  console.log("[handleUserMessage] Current state BEFORE processing:", JSON.stringify(conversationState, null, 2)); // Log state clearly

  // --- Reset Flow ---
  if (message === RESET_CONVERSATION_TRIGGER) {
    console.log("[handleUserMessage] Received reset trigger.");
    resetConversationState();
    return { responseText: "Conversation reset. All tasks cleared." }; // Updated message
  }

  // --- View Tasklist Flow ---
   if (message === VIEW_TASKLIST_TRIGGER) {
       console.log("[handleUserMessage] Received view tasklist trigger.");
       conversationState.currentFlow = 'view_tasks'; // Set flow state
       const taskListText = await fetchAndFormatTasks();
       addMessageToHistory('ai', taskListText); // Add task list to history
       conversationState.currentFlow = null; // Reset flow state after displaying
       return { responseText: taskListText };
   }


  // Determine the message sender type based on whether it's a trigger or a button response
  // Treat button responses (like Chat, Email, Whatsapp, Yes, No) as 'user' input for the LLM history.
  const senderType: OnboardingMessage['sender'] =
    (message === ONBOARDING_TRIGGER || message === CREATE_PRODUCT_TRIGGER) ? 'action' : 'user';


  // Add user message/action to history *unless* it's the initial trigger for a flow *and* no flow is active
  let shouldAddToHistory = true;
   if (message === ONBOARDING_TRIGGER && conversationState.currentFlow !== 'onboarding') {
      shouldAddToHistory = false;
   }
    if (message === CREATE_PRODUCT_TRIGGER && conversationState.currentFlow !== 'create_product') {
      shouldAddToHistory = false;
    }
    // Don't add view tasklist trigger to history here, it's handled above
    if (message === VIEW_TASKLIST_TRIGGER) {
      shouldAddToHistory = false;
    }

  if (shouldAddToHistory) {
     addMessageToHistory(senderType, message);
  }


  try {
    // --- Determine Flow ---
    // Prioritize active flow state over the incoming message trigger if a flow is already running.
    let activeFlow = conversationState.currentFlow;

    // If no flow is active, check if the message triggers a new flow.
    if (!activeFlow) {
        if (message === ONBOARDING_TRIGGER) {
            console.log("[handleUserMessage] Triggering NEW onboarding interview...");
            activeFlow = 'onboarding';
            conversationState.currentFlow = 'onboarding';
        } else if (message === CREATE_PRODUCT_TRIGGER) {
            console.log("[handleUserMessage] Triggering NEW create product flow...");
            activeFlow = 'create_product';
            conversationState.currentFlow = 'create_product';
        }
        // Note: VIEW_TASKLIST is handled directly above, not entering the switch
    }

    console.log(`[handleUserMessage] Determined activeFlow = ${activeFlow}`);

    // --- Execute Flow ---
    switch (activeFlow) {
      case 'onboarding':
        console.log("[handleUserMessage] Entering ONBOARDING flow block.");
        // Call the onboarding flow with the current history
        const onboardingResult = await conductOnboardingInterview({ conversationHistory: conversationState.history });
        console.log("[handleUserMessage] Onboarding flow returned:", JSON.stringify(onboardingResult, null, 2)); // Log result clearly

        // Add AI response (question or completion message) to history
        if (onboardingResult.nextQuestion) {
            // Don't add the [OPTIONS] marker to history
            const questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, '');
            addMessageToHistory('ai', questionText);
        }

        // Check if the interview is complete
        if (onboardingResult.isComplete) {
          console.log("[handleUserMessage] Onboarding marked as COMPLETE.");

          if (onboardingResult.onboardingData) {
            try {
              // Validate the structure (optional but recommended)
              // OnboardingDataSchema.parse(onboardingResult.onboardingData); // Assuming schema is imported/defined

              // --- Task Creation Logic ---
               if (onboardingResult.answeredStripe) { // Check if Stripe question was the last one answered
                   console.log("[handleUserMessage] Stripe question answered. Creating task...");
                   await createOnboardingTask(onboardingResult.onboardingData); // Create task based on the answer
               } else {
                   console.log("[handleUserMessage] Onboarding complete, but Stripe wasn't the last question. No task created this turn.");
               }

              // --- Format Final Response ---
              const jsonResponse = JSON.stringify(onboardingResult.onboardingData, null, 2);
              let finalMessage = `Onboarding complete! Here's the collected information:\n\`\`\`json\n${jsonResponse}\n\`\`\``;

              // Add task-related info to the final message
              if (onboardingResult.answeredStripe) {
                   if (onboardingResult.onboardingData.hasStripe === false) {
                       finalMessage += "\n\nA task has been added to your list to create a Stripe account.";
                   } else if (onboardingResult.onboardingData.hasStripe === true) {
                       finalMessage += "\n\nA task has been added to your list to connect your Stripe account.";
                   }
               }
               finalMessage += "\nYou can view your tasks using the Tasklist button.";

              addMessageToHistory('ai', finalMessage); // Add final summary to history
              console.log("[handleUserMessage] Returning formatted onboarding data:", finalMessage);
              conversationState.currentFlow = null; // Reset flow state AFTER processing
              return { responseText: finalMessage };

            } catch (validationError) {
              console.error("[handleUserMessage] Error validating or processing onboarding result:", validationError);
              const errorMsg = "Sorry, there was an issue processing the final onboarding information.";
               addMessageToHistory('ai', errorMsg);
               conversationState.currentFlow = null; // Reset flow state on error
              return { responseText: errorMsg };
            }
          } else {
              // Should ideally not happen if isComplete is true based on the flow logic
              console.error("[handleUserMessage] Onboarding complete but no data returned.");
               const errorMsg = "Onboarding seems complete, but I couldn't retrieve the final data.";
               addMessageToHistory('ai', errorMsg);
               conversationState.currentFlow = null; // Reset flow state
               return { responseText: errorMsg };
          }
        } else if (onboardingResult.nextQuestion) {
          console.log("[handleUserMessage] Onboarding asking next question.");
          // Check for the [OPTIONS] marker to generate buttons
          const optionsMatch = onboardingResult.nextQuestion.match(/ \[OPTIONS: (.*?)\]$/);
          let actions: Array<{ label: string; trigger: string }> | undefined = undefined;
          let questionText = onboardingResult.nextQuestion;

          if (optionsMatch) {
            const options = optionsMatch[1].split(',').map(opt => opt.trim());
            actions = options.map(opt => ({ label: opt, trigger: opt })); // Use option text as trigger
            questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, ''); // Remove marker from text shown to user
            console.log(`[handleUserMessage] Found options: ${options.join(', ')}. Generating actions.`);
          }

          // Ask the next question, potentially with actions (buttons)
          console.log("[handleUserMessage] Asking next onboarding question:", questionText);
          // Keep conversationState.currentFlow = 'onboarding'
          return { responseText: questionText, actions: actions };

        } else {
           // Handle unexpected case where interview is not complete but no question is provided
           console.error("[handleUserMessage] Onboarding flow error: Not complete, but no next question.");
           const errorMsg = "Sorry, I got stuck during the onboarding process. Could you try starting again?";
           addMessageToHistory('ai', errorMsg);
           conversationState.currentFlow = null; // Reset flow
           return { responseText: errorMsg };
        }

      case 'create_product':
         console.log("[handleUserMessage] Placeholder for Create Product flow.");
         const response = "The 'Create Product' feature is not implemented yet.";
         addMessageToHistory('ai', response);
         conversationState.currentFlow = null; // Reset immediately for this placeholder
         return { responseText: response };

      // Note: 'view_tasks' case is handled directly before the switch

      default:
        // --- Default/Praise Agent Flow (when no specific flow is active) ---
        console.log("[handleUserMessage] No active flow, proceeding with default handling (parse/triage/praise test).");

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
            const spamResponse = "This message appears to be spam and has been discarded.";
            addMessageToHistory('ai', spamResponse);
            return { responseText: spamResponse };
        }

        // 3. Executive Agent (Direct Delegation to Praise Agent FOR TESTING)
        console.log("[handleUserMessage] Step 3: Delegating to praiseAgent (testing)...");
        const praiseResult = await praiseAgent({ message: message });
        console.log("[handleUserMessage] Step 3: praiseAgent successful. Result:", praiseResult);

        if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
            console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
            const errorResponse = "Sorry, the Praise Agent couldn't process the message correctly.";
             addMessageToHistory('ai', errorResponse);
             return { responseText: errorResponse };
        }

        // 4. Return Praise Agent's Response
        console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
        addMessageToHistory('ai', praiseResult.praisedMessage);
        return { responseText: praiseResult.praisedMessage };
    }

  } catch (error: any) {
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    const errorMessage = error?.message || 'Unknown error';
    const finalErrorMsg = `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${errorMessage})`;
    addMessageToHistory('ai', finalErrorMsg); // Log error response to history
    conversationState.currentFlow = null; // Reset flow state on error
    return { responseText: finalErrorMsg };
  } finally {
       console.log("[handleUserMessage] Final state AFTER processing:", JSON.stringify(conversationState, null, 2)); // Log final state
  }
}

// TODO: Replace in-memory state and task storage with Firestore.
// TODO: Implement task completion logic (e.g., buttons in task list).
// TODO: Implement updateTask flow usage.
// TODO: Refine getTasks flow to handle user context (userId).
// TODO: Implement actual sub-agent execution logic based on triage/intent when not testing praise agent.
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents.
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.
