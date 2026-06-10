import React, { useState, useEffect } from 'react';
import { Search, Send, User, Settings as SettingsIcon, MoreHorizontal, Phone, Video, Plus, X } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface Chat {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
}

interface Message {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  sender: 'me' | 'other';
  createdAt: number;
}

export default function MessagesView() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingChat, setIsAddingChat] = useState(false);
  const [newChatName, setNewChatName] = useState('');

  // Fetch chats
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Chat[];
      data.sort((a, b) => b.createdAt - a.createdAt);
      setChats(data);
      if (!activeChat && data.length > 0) {
        setActiveChat(data[0].id);
      }
    }, error => handleFirestoreError(error, OperationType.LIST, 'chats'));
    return () => unsubscribe();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, 'messages'), where('chatId', '==', activeChat));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
      data.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'messages'));
    return () => unsubscribe();
  }, [user, activeChat]);

  const handleAddChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newChatName.trim()) return;
    const newId = doc(collection(db, 'chats')).id;
    try {
      await setDoc(doc(db, 'chats', newId), {
        userId: user.uid,
        name: newChatName.trim(),
        createdAt: Date.now()
      });
      setNewChatName('');
      setIsAddingChat(false);
      setActiveChat(newId);
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !activeChat || !inputText.trim()) return;
    const newId = doc(collection(db, 'messages')).id;
    try {
      await setDoc(doc(db, 'messages', newId), {
        chatId: activeChat,
        userId: user.uid,
        text: inputText.trim(),
        sender: 'me',
        createdAt: Date.now()
      });
      setInputText('');
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentChatObj = chats.find(c => c.id === activeChat);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[650px] flex overflow-hidden h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-navy-900">메시지</h2>
            <button onClick={() => setIsAddingChat(true)} className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="채팅방 검색" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChat(chat.id)}
              className={`p-4 flex flex-col cursor-pointer transition-colors border-b border-gray-50/50 ${activeChat === chat.id ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-semibold text-navy-900 truncate">{chat.name}</span>
              </div>
            </div>
          ))}
          {filteredChats.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">채팅방이 없습니다. 추가해주세요.</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-navy-900">{currentChatObj?.name}</h3>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[70%] ${msg.sender === 'me' ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-navy-900 rounded-bl-sm shadow-sm'}`}>
                    <p className="text-sm break-words">{msg.text}</p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  메시지가 없습니다.
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2 relative">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="메시지 입력..." 
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                />
                <button 
                  onClick={handleSendMessage}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${inputText.trim() ? 'bg-brand-500 text-white' : 'text-gray-400'}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
            <Search className="w-12 h-12 mb-4 text-gray-300" />
            <p>채팅방을 선택하거나 새로 만들어주세요.</p>
          </div>
        )}
      </div>

      {isAddingChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">새 방 만들기</h3>
              <button onClick={() => setIsAddingChat(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddChat}>
              <input 
                type="text" 
                autoFocus required
                value={newChatName} 
                onChange={e => setNewChatName(e.target.value)}
                placeholder="방 이름"
                className="w-full border-gray-200 rounded-xl px-4 py-2 mb-4 outline-none border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button type="submit" className="w-full bg-brand-500 text-white py-2 rounded-xl font-medium hover:bg-brand-600">생성하기</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
