import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Ticket, Trash2, Send, Plus, ChevronRight, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}`;

const MyTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/api/support/tickets/my`);
      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch tickets');
    }
  };

  const deleteTicket = async (ticketId) => {
    try {
      await axios.delete(`${API}/api/support/tickets/${ticketId}`);
      setTickets(tickets.filter(ticket => ticket.id !== ticketId));
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(null);
      }
      toast.success('Ticket deleted successfully');
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Failed to delete ticket');
    }
  };

  const handleReply = async (e, ticketId) => {
    e.preventDefault();
    const replyText = replyTexts[ticketId]?.trim();
    if (!replyText) return;

    try {
      await axios.put(`${API}/api/support/tickets/${ticketId}/reply`, {
        user_reply: replyText
      });

      // Update local state to show the new message
      const newMessage = {
        sender: 'user',
        message: replyText,
        timestamp: new Date().toISOString()
      };

      setTickets(tickets.map(ticket =>
        ticket.id === ticketId
          ? {
              ...ticket,
              messages: [...ticket.messages, newMessage]
            }
          : ticket
      ));

      // Update selected ticket if it's the current one
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({
          ...selectedTicket,
          messages: [...selectedTicket.messages, newMessage]
        });
      }

      // Clear the reply text
      setReplyTexts(prev => ({ ...prev, [ticketId]: '' }));
      toast.success('Reply sent successfully');

      // Auto-scroll to bottom after a short delay to ensure DOM update
      setTimeout(() => {
        const chatContainer = document.querySelector('.ticket-chat-container');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    }
  };

  const selectTicket = (ticket) => {
    setSelectedTicket(ticket);
  };

  const closeTicket = () => {
    setSelectedTicket(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8">My Tickets</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <CardTitle className="flex items-center">
              <Ticket className="h-5 w-5 mr-2" />
              Support Tickets
            </CardTitle>
            <Button onClick={() => window.location.href = '/help?tab=support'}>
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length > 0 ? (
            <div className="space-y-6">
              {/* Ticket List */}
              <div className="grid gap-3">
                {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => selectTicket(ticket)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedTicket && selectedTicket.id === ticket.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-sm text-gray-600">
                            Ticket #{ticket.id.slice(-8)}
                          </span>
                          <Badge variant={ticket.status === 'closed' ? 'secondary' : 'default'}>
                            {ticket.status}
                          </Badge>
                          {ticket.messages && ticket.messages.length > 0 && (
                            <MessageCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1 truncate">
                          {ticket.subject}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {new Date(ticket.created_at).toLocaleDateString()} {new Date(ticket.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Ticket Chat View */}
              {selectedTicket && (
                <div className="border-t pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {selectedTicket.subject}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-600">
                          Ticket #{selectedTicket.id.slice(-8)}
                        </span>
                        <Badge variant={selectedTicket.status === 'closed' ? 'secondary' : 'default'}>
                          {selectedTicket.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Created: {new Date(selectedTicket.created_at).toLocaleDateString()} {new Date(selectedTicket.created_at).toLocaleTimeString()}
                      </p>
                      {selectedTicket.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {selectedTicket.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={closeTicket}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Close
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTicket(selectedTicket.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    <div className="mb-4">
                      <div
                        className="ticket-chat-container max-h-96 overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg border"
                      >
                        {selectedTicket.messages.map((message, index) => (
                          <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                              message.sender === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-gray-800 border'
                            }`}>
                              <div>{message.message}</div>
                              <div className={`text-xs mt-1 font-medium ${
                                message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {message.sender === 'user' ? 'You' : 'Admin'} • {new Date(message.timestamp).toLocaleDateString()} {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border">
                      <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No messages yet</p>
                    </div>
                  )}

                  {/* Reply Input */}
                  {selectedTicket.status !== 'closed' && (
                    <form onSubmit={(e) => handleReply(e, selectedTicket.id)} className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Type your reply..."
                        value={replyTexts[selectedTicket.id] || ''}
                        onChange={(e) => setReplyTexts(prev => ({ ...prev, [selectedTicket.id]: e.target.value }))}
                        className="flex-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleReply(e, selectedTicket.id);
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!replyTexts[selectedTicket.id]?.trim()}
                        className="px-3 bg-black hover:bg-gray-800 text-white"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Ticket className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets yet</h3>
              <p className="text-gray-600 mb-6">Create your first support ticket to get help</p>
              <Button onClick={() => window.location.href = '/help?tab=support'}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Ticket
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTicketsPage;
