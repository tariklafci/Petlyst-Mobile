// ChatAIScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

const ChatAIScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  // auto-scroll
  useEffect(() => {
    if (messages.length && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      text: input.trim(),
      sender: 'user',
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        return;
      }

      const res = await fetch('http://192.168.0.101:3001/api/generate-response', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({
          prompt: userMsg.text,
          history: messages.map(m => ({ sender: m.sender, text: m.text }))
         })
        });


      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Status ${res.status}`);
      }

      const data = await res.json();

      // prefer code array if you want just the snippet, otherwise fall back to raw
      const botText = Array.isArray(data.code)
        ? data.code.join('\n')
        : data.raw || 'No response';

      const botMsg: Message = {
        id: `${Date.now()}-bot`,
        text: botText,
        sender: 'bot',
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err:any) {
      console.error('Chat API error:', err);
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}-bot-error`, text: `⚠️ ${err.message}`, sender: 'bot' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.bubbleContainer, isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.botText]}>
          {item.text}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6c63ff', '#3b5998']} style={styles.header}>
        <Text style={styles.headerTitle}>AI Chat</Text>
      </LinearGradient>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.chatContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Start the conversation!</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={input}
            onChangeText={setInput}
            editable={!sending}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          {sending ? (
            <ActivityIndicator style={styles.sendButton} color="#6c63ff" />
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={24} color="#6c63ff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  chatContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: '#888' },
  bubbleContainer: { maxWidth: '75%', marginVertical: 6, padding: 12, borderRadius: 16 },
  userBubble: {
    backgroundColor: '#6c63ff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#e0e0ff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  userText: { color: '#fff' },
  botText: { color: '#333' },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    fontSize: 16,
  },
  sendButton: { marginLeft: 12 },
});

export default ChatAIScreen;
