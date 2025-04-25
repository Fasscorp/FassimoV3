"use client";

import * as React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { handleUserMessage } from '@/actions/handle-user-message'; // Action to handle user message

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export function ChatInterface() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call the server action to handle the user message
      const aiResponseText = await handleUserMessage(input, 'chat'); // Pass channel 'chat'

      const aiMessage: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: aiResponseText };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: `Sorry, I encountered an error. Please try again. Details: ${error instanceof Error ? error.message : 'Unknown error'}` };
      setMessages((prev) => [...prev, errorMessage]);
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
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg rounded-lg">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-semibold text-foreground">FASSIMO v3.0</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender === "ai" && (
                    <Avatar className="h-8 w-8">
                       <AvatarImage src="https://picsum.photos/32/32?grayscale" alt="AI Avatar" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg p-3 max-w-[75%] whitespace-pre-wrap ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {message.text}
                  </div>
                   {message.sender === "user" && (
                     <Avatar className="h-8 w-8">
                       <AvatarImage src="https://picsum.photos/32/32" alt="User Avatar" />
                       <AvatarFallback>U</AvatarFallback>
                    </Avatar>
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
      </Card>
    </div>
  );
}
