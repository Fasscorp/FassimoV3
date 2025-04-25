
"use client";

import * as React from "react";
import Image from 'next/image'; // Import next/image
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Plus, Clipboard, RefreshCw, MessageSquare, Mail, Phone } from "lucide-react"; // Added more icons
import { handleUserMessage } from '@/actions/handle-user-message'; // Action to handle user message

interface MessageAction {
  label: string;
  trigger: string;
}

interface Message {
  id: string;
  sender: "user" | "ai" | "system" | "action";
  text: string;
  actions?: MessageAction[]; // Optional actions (buttons)
}

// Define the specific trigger messages
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';
const CREATE_PRODUCT_TRIGGER = 'START_CREATE_PRODUCT';
const RESET_CONVERSATION_TRIGGER = 'RESET_CONVERSATION';

// Initial message definition
const initialMessage: Message = {
  id: "initial-greeting",
  sender: "system",
  text: "Hello! What would you like to work on today?",
  actions: [
    { label: "Onboarding", trigger: ONBOARDING_TRIGGER },
    { label: "Create Product", trigger: CREATE_PRODUCT_TRIGGER },
  ],
};

export function ChatInterface() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showInput, setShowInput] = React.useState(false); // Initially hide input until a choice is made
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Function to reset the chat
  const resetChat = async () => {
    console.log("[resetChat] Resetting conversation...");
    setIsLoading(true);
    try {
      const resetResponse = await handleUserMessage(RESET_CONVERSATION_TRIGGER, 'chat');
      setMessages([initialMessage]); // Reset to the initial greeting and options
      setInput("");
      setShowInput(false); // Hide input again
    } catch (error) {
       console.error("Error resetting chat:", error);
       setMessages(prev => [...prev, { id: 'reset-error', sender: 'system', text: 'Failed to reset the conversation. Please try again.'}]);
    } finally {
        setIsLoading(false);
    }
  };


  // Function to send a regular text message
  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), sender: "user", text: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    await processMessage(trimmedInput, "user");
  };

  // Function to handle button clicks (actions)
  const handleActionClick = async (trigger: string, label?: string) => {
     if (isLoading) return;

    // Remove actions from the message that was clicked
    setMessages(prevMessages =>
        prevMessages.map((msg) =>
            msg.actions?.some(a => a.trigger === trigger) ? { ...msg, actions: undefined } : msg
        )
    );


    // Use the provided label or the trigger itself as the text for the history
    const actionText = label || trigger;
    const userChoiceMessage: Message = { id: Date.now().toString(), sender: "action", text: actionText };
    setMessages((prev) => [...prev, userChoiceMessage]);


    await processMessage(trigger, "action"); // Pass trigger and 'action' type

    // Show the input field after the initial choice or if needed based on response
     setShowInput(true);
  };

  // Central function to process messages (user input or action triggers)
  const processMessage = async (content: string, type: "user" | "action") => {
    setIsLoading(true);

    try {
      // Call the server action - it now returns an object { responseText, actions? }
      const response = await handleUserMessage(content, 'chat');

      // Add the AI's response message, potentially with new actions
      const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: response.responseText,
          actions: response.actions // Pass actions from backend response
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Determine if input should be shown based on whether the AI provided actions or completed a flow
      const lowerResponse = response.responseText.toLowerCase();
      const isComplete = lowerResponse.includes("complete") || lowerResponse.includes("error") || lowerResponse.includes("sorry");
      const hasActions = response.actions && response.actions.length > 0;

      if (!isComplete && !hasActions) {
         setShowInput(true); // Show input if flow is ongoing and no buttons are provided
      } else if (hasActions) {
         setShowInput(false); // Hide input if buttons are provided for the next step
      }
       // Keep input hidden if the flow completed or hit an error (unless explicitly shown above)

    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessageText = `Sorry, I encountered an error processing your request. Details: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const errorMessage: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: errorMessageText };
      setMessages((prev) => [...prev, errorMessage]);
      setShowInput(true); // Show input on error to allow user to retry or type something else
    } finally {
      setIsLoading(false);
    }
  };


  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  React.useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[style*="overflow: hidden scroll;"]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-background p-4">
      {/* Skillplate Logo */}
      <div className="mb-4">
        <Image
            src="https://cdn.skillplate.com/skillplate-logo.svg"
            alt="Skillplate Logo"
            width={150} // Adjust width as needed
            height={50} // Adjust height as needed
            priority // Load logo faster
        />
      </div>
      {/* Chat Card */}
      <Card className="w-full max-w-2xl shadow-lg rounded-lg">
        <CardHeader className="border-b flex flex-row justify-between items-center">
          <CardTitle className="text-lg font-semibold text-foreground">FASSIMO v3.0</CardTitle>
          <Button variant="destructive" size="icon" onClick={resetChat} disabled={isLoading} aria-label="Reset chat">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  <div
                    className={`flex items-start gap-3 ${
                      message.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {(message.sender === "ai" || message.sender === "system") && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="https://picsum.photos/32/32?grayscale" alt="AI Avatar" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    )}
                     {/* Action messages styled like user input but aligned left */}
                    {message.sender === "action" && (
                      <>
                         <Avatar className="h-8 w-8 invisible"> {/* Placeholder to maintain alignment */}
                            <AvatarFallback>U</AvatarFallback>
                          </Avatar>
                          <div className="rounded-lg p-3 max-w-[75%] whitespace-pre-wrap bg-muted text-muted-foreground">
                                {message.text}
                          </div>
                      </>
                    )}

                    {/* User messages */}
                    {message.sender === "user" && (
                         <div className="rounded-lg p-3 max-w-[75%] whitespace-pre-wrap bg-primary text-primary-foreground">
                              {message.text}
                         </div>
                    )}

                     {/* AI and System messages */}
                     {(message.sender === "ai" || message.sender === "system") && (
                         <div className={`rounded-lg p-3 max-w-[75%] whitespace-pre-wrap ${message.sender === 'ai' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {message.text}
                         </div>
                     )}


                    {message.sender === "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="https://picsum.photos/32/32" alt="User Avatar" />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                   {/* Render action buttons below the message */}
                   {message.actions && (
                     <div className="flex justify-start gap-2 mt-2 pl-11"> {/* Adjusted padding to align with AI message */}
                       {message.actions.map((action) => (
                         <Button
                           key={action.trigger}
                           variant="outline"
                           size="sm"
                           onClick={() => handleActionClick(action.trigger, action.label)} // Pass label too
                           disabled={isLoading}
                         >
                            {/* Add icons based on action label - extend as needed */}
                            {action.label === "Onboarding" && <Clipboard className="mr-2 h-4 w-4" />}
                            {action.label === "Create Product" && <Plus className="mr-2 h-4 w-4" />}
                            {action.label === "Chat" && <MessageSquare className="mr-2 h-4 w-4" />}
                            {action.label === "Email" && <Mail className="mr-2 h-4 w-4" />}
                            {action.label === "Whatsapp" && <Phone className="mr-2 h-4 w-4" />} {/* Using Phone as proxy */}
                            {action.label}
                         </Button>
                       ))}
                     </div>
                   )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://picsum.photos/32/32?grayscale" alt="AI Avatar" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-3 bg-secondary text-secondary-foreground animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
         {/* Conditionally render the input area */}
         {showInput && (
          <CardFooter className="p-4 border-t">
            <div className="flex w-full items-center space-x-2">
              <Textarea
                placeholder="Type your message here..."
                className="flex-1 resize-none min-h-[40px] max-h-[150px]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                aria-label="Chat input"
              />
              <Button type="submit" size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
         )}
      </Card>
    </div>
  );
}
