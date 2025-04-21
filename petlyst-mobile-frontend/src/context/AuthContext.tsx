import React, { createContext, useReducer, useMemo, ReactNode, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Define the state type
interface AuthState {
  userToken: string | null;
  isLoading: boolean;
}

// Define action types
type AuthAction =
  | { type: 'SIGN_IN'; token: string }
  | { type: 'SIGN_OUT' }
  | { type: 'SET_LOADING'; isLoading: boolean };

// Reducer function
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, userToken: action.token, isLoading: false };
    case 'SIGN_OUT':
      return { ...state, userToken: null, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

// Initial state
const initialState: AuthState = {
  userToken: null,
  isLoading: true,
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

  // Check for stored token on app startup
  useEffect(() => {
    const checkForStoredToken = async () => {
      try {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        const storedToken = await AsyncStorage.getItem('userToken');
        if (storedToken) {
          dispatch({ type: 'SIGN_IN', token: storedToken });
        } else {
          dispatch({ type: 'SET_LOADING', isLoading: false });
        }
      } catch (error) {
        console.error('Error checking for stored token:', error);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    };

    checkForStoredToken();
  }, []);

  const authContext = useMemo(() => ({
    signIn: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await fetch('https://petlyst.com:3001/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || 'Login failed');
        }

        const { token, user_id } = await response.json();
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userId', user_id.toString());
        dispatch({ type: 'SIGN_IN', token });
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
        const response = await fetch('https://petlyst.com:3001/api/register', {
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

        // After successful registration, automatically log in the user
        const loginResponse = await fetch('https://petlyst.com:3001/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!loginResponse.ok) {
          throw new Error('Auto-login after registration failed');
        }

        const { token, user_id } = await loginResponse.json();
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userId', user_id.toString());
        dispatch({ type: 'SIGN_IN', token });
      } catch (error: any) {
        console.error('signUp error:', error);
        Alert.alert('Sign Up Error', error.message);
        throw error;
      }
    },

    signOut: async () => {
      try {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userId');
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
