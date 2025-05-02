import React, { createContext, useReducer, useMemo, ReactNode, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// Define the state type
interface AuthState {
  userToken: string | null;
  user_type: string | null;
}

// Define action types
type AuthAction =
  | { type: 'SIGN_IN'; token: string; user_type: string }
  | { type: 'SIGN_OUT' };

// Reducer function
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, userToken: action.token, user_type: action.user_type };
    case 'SIGN_OUT':
      return { ...state, userToken: null, user_type: null };
    default:
      return state;
  }
}

// Initial state
const initialState: AuthState = {
  userToken: null,
  user_type: null,
};

// Define context value type
interface AuthContextType {
  state: AuthState;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signUp: (params: {
    name: string;
    surname: string;
    email: string;
    password: string;
    user_type: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

// Create the AuthContext
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the AuthProviderProps
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const authContext = useMemo(() => ({
    signIn: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await fetch('http://192.168.0.101:3001/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || 'Login failed');
        }

        const { token, user_id, user_type } = await response.json();
        await SecureStore.setItemAsync('userToken', token);
        await SecureStore.setItemAsync('userId', user_id.toString());
        await SecureStore.setItemAsync('userType', user_type);
        dispatch({ type: 'SIGN_IN', token, user_type });
      } catch (error: any) {
        console.error('signIn error:', error);
        Alert.alert('Login Error', error.message);
        throw error;
      }
    },

    signUp: async ({
      name,
      surname,
      email,
      password,
      user_type,
    }: {
      name: string;
      surname: string;
      email: string;
      password: string;
      user_type: string;
    }) => {
      try {
        const response = await fetch('http://192.168.0.101:3001/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            surname,
            email,
            password,
            user_type,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || 'Sign up failed');
        }
      } catch (error: any) {
        console.error('signUp error:', error);
        Alert.alert('Sign Up Error', error.message);
        throw error;
      }
    },

    signOut: async () => {
      try {
        await SecureStore.deleteItemAsync('userToken');
        await SecureStore.deleteItemAsync('userId');
        await SecureStore.deleteItemAsync('userType');
        dispatch({ type: 'SIGN_OUT' });
      } catch (error) {
        console.error('signOut error:', error);
      }
    },

    state,
  }), [state]);

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
