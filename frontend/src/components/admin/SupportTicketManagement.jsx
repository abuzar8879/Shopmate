import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, MessageCircle, X, Trash2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SupportTicketManagement = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/support/tickets`);
      setTickets(response.data);
    } catch (error) {
      toast.error('Failed to fetch tickets');
    }
  };

  const handleReplyChange = (ticketId, text) => {
    setReplyTexts(prev => ({ ...prev, [ticketId]: text }));
  };

  const handleReplySubmit = async (ticketId) => {
    const reply = replyTexts[ticketId];
    if (!reply || reply.trim() === '') {
      toast.error('Reply cannot be empty');
      return;
    }
    try {
      await axios.put(`${API}/api/admin/support/tickets/${ticketId}`, {
        admin_reply: reply
      });
      toast.success('Reply sent successfully');
      setReplyTexts(prev => ({ ...prev, [ticketId]: '' }));

      // Refresh tickets and update selected ticket if it's the current one
      const response = await axios.get(`${API}/api/admin/support/tickets`);
      setTickets(response.data);

      if (selectedTicket && selectedTicket.id === ticketId) {
        const updatedTicket = response.data.find(t => t.id === ticketId);
        if (updatedTicket) {
          setSelectedTicket(updatedTicket);
        }
      }
    } catch (error) {
      toast.error('Failed to send reply');
    }
  };

  const handleCloseTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to close this ticket?')) return;
    try {
      await axios.put(`${API}/api/admin/support/tickets/${ticketId}`, {
        status: 'closed'
      });
      toast.success('Ticket closed');
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(null);
      }
      fetchTickets();
    } catch (error) {
      toast.error('Failed to close ticket');
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    try {
      await axios.delete(`${API}/api/admin/support/tickets/${ticketId}`);
      toast.success('Ticket deleted');
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(null);
      }
      fetchTickets();
    } catch (error) {
      toast.error('Failed to delete ticket');
    }
  };

  const selectTicket = (ticket) => {
    setSelectedTicket(ticket);
  };

  const closeTicket = () => {
    setSelectedTicket(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center flex-wrap gap-3 mb-6">
          <a href="/admin">
            <Button className="flex items-center space-x-2 bg-black text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          </a>
          <h1 className="text-2xl sm:text-3xl font-bold">Manage Support Tickets</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Support Tickets</CardTitle>
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
                          <div className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">{ticket.name}</span> • {ticket.email}
                          </div>
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
                        <div className="text-sm text-gray-600 mt-1">
                          <strong>{selectedTicket.name}</strong> • {selectedTicket.email}
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
                          variant="outline"
                          size="sm"
                          onClick={() => handleCloseTicket(selectedTicket.id)}
                        >
                          Mark Closed
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTicket(selectedTicket.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Chat Messages */}
                    {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                      <div className="mb-4">
                        <div className="ticket-chat-container max-h-96 overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg border">
                          {selectedTicket.messages.map((message, index) => (
                            <div key={index} className={`flex ${message.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                                message.sender === 'admin'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-800 border'
                              }`}>
                                <div>{message.message}</div>
                                <div className={`text-xs mt-1 font-medium ${
                                  message.sender === 'admin' ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  {message.sender === 'admin' ? 'Admin' : 'User'} • {new Date(message.timestamp).toLocaleDateString()} {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
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
                      <div className="mt-4">
                        <Textarea
                          placeholder="Write a reply..."
                          value={replyTexts[selectedTicket.id] || ''}
                          onChange={(e) => handleReplyChange(selectedTicket.id, e.target.value)}
                          rows={3}
                        />
                        <div className="mt-2">
                          <Button onClick={() => handleReplySubmit(selectedTicket.id)}>Send Reply</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets yet</h3>
                <p className="text-gray-600">All support tickets will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupportTicketManagement;
