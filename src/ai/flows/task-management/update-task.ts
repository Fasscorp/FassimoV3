
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
import { internalUpdateTask, type Task } from './get-tasks'; // Import internal function and Task type

// Define the input schema for updating a task
const UpdateTaskInputSchema = z.object({
  taskId: z.string().describe('The unique ID of the task to update.'),
  updates: z.object({
      description: z.string().optional().describe('Updated description.'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Updated priority.'),
      dueDate: z.string().optional().nullable().describe('Updated due date (ISO 8601 format) or null to clear.'), // Allow null to clear date
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
    // 3. Update the document with the provided fields in input.updates. Handle nulls for clearing fields.
    // 4. Handle cases where the task is not found.
    // ----------------------------------------

    // Mocking database interaction using the internal function:
    const updatesToApply: Partial<Task> = {};
    if (input.updates.description !== undefined) {
        updatesToApply.description = input.updates.description;
    }
    if (input.updates.priority !== undefined) {
        updatesToApply.priority = input.updates.priority;
    }
    if (input.updates.hasOwnProperty('dueDate')) { // Check if dueDate was explicitly provided
        updatesToApply.dueDate = input.updates.dueDate === null ? undefined : input.updates.dueDate; // Map null to undefined for mock DB
    }
    if (input.updates.completed !== undefined) {
        updatesToApply.completed = input.updates.completed;
    }

    const success = internalUpdateTask(input.taskId, updatesToApply); // Update using internal function
    let message = success
        ? `Task ${input.taskId} updated successfully.`
        : `Task with ID ${input.taskId} not found.`;

    console.log(`[updateTaskFlow] Task update attempt via internal function. Success: ${success}`);

    const output: UpdateTaskOutput = {
      success: success,
      message: message,
    };

    console.log("[updateTaskFlow] Flow successful. Returning output:", output);
    return output;
  }
);
