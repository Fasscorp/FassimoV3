
'use server';
/**
 * @fileOverview Defines the Update Task flow using Genkit.
 * This flow updates an existing task in a persistent store (e.g., Firestore).
 *
 * - updateTask - Function to invoke the update task flow.
 * - UpdateTaskInput - Input type specifying the task ID and updates.
 * - UpdateTaskOutput - Output type confirming task update.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the input schema for updating a task
const UpdateTaskInputSchema = z.object({
  taskId: z.string().describe('The unique ID of the task to update.'),
  updates: z.object({
      description: z.string().optional().describe('Updated description.'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Updated priority.'),
      dueDate: z.string().optional().describe('Updated due date (ISO 8601 format).'),
      completed: z.boolean().optional().describe('Updated completion status.'),
  }).describe('The fields to update.'),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

// Define the output schema for the update task flow
const UpdateTaskOutputSchema = z.object({
  success: z.boolean().describe('Indicates whether the update was successful.'),
  message: z.string().describe('Confirmation or error message.'),
});
export type UpdateTaskOutput = z.infer<typeof UpdateTaskOutputSchema>;

/**
 * Updates an existing task in the task list.
 * In a real application, this would interact with a database (e.g., Firestore).
 * @param input The ID of the task to update and the updates to apply.
 * @returns Confirmation of task update.
 */
export async function updateTask(input: UpdateTaskInput): Promise<UpdateTaskOutput> {
  console.log("[updateTask] Invoked with input:", input);
  // In a real app, replace this mock flow with actual database interaction.
  return updateTaskFlow(input);
}

// Define the Genkit flow for updating a task
const updateTaskFlow = ai.defineFlow<
  typeof UpdateTaskInputSchema,
  typeof UpdateTaskOutputSchema
>(
  {
    name: 'updateTaskFlow',
    inputSchema: UpdateTaskInputSchema,
    outputSchema: UpdateTaskOutputSchema,
    // This flow doesn't need an LLM, it's for interacting with a service/database.
  },
  async (input) => {
    console.log("[updateTaskFlow] Flow invoked with:", input);

    // --- Database Interaction Placeholder ---
    // In a real application:
    // 1. Connect to Firestore (or your chosen DB).
    // 2. Find the task document with the given taskId.
    // 3. Update the document with the provided fields in input.updates.
    // 4. Handle cases where the task is not found.
    // ----------------------------------------

    // Mocking database interaction:
    let success = false;
    let message = `Task with ID ${input.taskId} not found in mock state.`;

     try {
        // Dynamically import to access the state (NOT RECOMMENDED FOR PRODUCTION)
        const { conversationState } = await import('@/actions/handle-user-message');

        if (conversationState && conversationState.tasks) {
             const taskIndex = conversationState.tasks.findIndex(t => t.id === input.taskId);

             if (taskIndex > -1) {
                 // Apply updates
                 const updatedTask = { ...conversationState.tasks[taskIndex], ...input.updates };
                 conversationState.tasks[taskIndex] = updatedTask; // Update in-memory state

                 success = true;
                 message = `Task ${input.taskId} updated successfully in mock state.`;
                 console.log(`[updateTaskFlow] Mocking database update for Task ID: ${input.taskId}. New state:`, updatedTask);
             }
        } else {
             console.warn("[updateTaskFlow] Mocking database update. Could not access in-memory tasks or tasks array is missing.");
             message = "Could not access task list for update.";
        }

    } catch (importError) {
         console.error("[updateTaskFlow] Mocking database update. Error importing handle-user-message:", importError);
         message = "Internal error accessing task list for update.";
    }


    const output: UpdateTaskOutput = {
      success: success,
      message: message,
    };

    console.log("[updateTaskFlow] Flow successful. Returning output:", output);
    return output;
  }
);
