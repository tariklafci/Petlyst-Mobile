import React, { createContext, useReducer, useMemo, ReactNode, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// Define the state type
interface AuthState {
  userToken: string | null;
  user_type: string | null;
  isLoading: boolean;
}

// Define action types
type AuthAction =
  | { type: 'SIGN_IN'; token: string; user_type: string }
  | { type: 'SIGN_OUT' }
  | { type: 'RESTORE_TOKEN'; token: string; user_type: string }
  | { type: 'SET_LOADING'; isLoading: boolean };

// Reducer function
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, userToken: action.token, user_type: action.user_type, isLoading: false };
    case 'SIGN_OUT':
      return { ...state, userToken: null, user_type: null, isLoading: false };
    case 'RESTORE_TOKEN':
      return { ...state, userToken: action.token, user_type: action.user_type, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

// Initial state
const initialState: AuthState = {
  userToken: null,
  user_type: null,
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
  refreshToken: () => Promise<boolean>;
}

// Create the AuthContext
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the AuthProviderProps
interface AuthProviderProps {
  children: ReactNode;
}

// Check if token is expired
const isTokenExpired = async (): Promise<boolean> => {
  try {
    const expiryTime = await SecureStore.getItemAsync('tokenExpiry');
    if (!expiryTime) return true;
    
    return Date.now() > parseInt(expiryTime);
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true;
  }
};

// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for stored token on app start
  useEffect(() => {
    const bootstrapAsync = async () => {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      
      try {
        const userToken = await SecureStore.getItemAsync('userToken');
        const userType = await SecureStore.getItemAsync('userType');
        
        if (userToken && userType) {
          // Check if token is expired
          const expired = await isTokenExpired();
          
          if (expired) {
            // Try to refresh the token
            const refreshed = await authContext.refreshToken();
            if (!refreshed) {
              // If refresh fails, sign out
              await authContext.signOut();
            }
          } else {
            // Token valid, restore session
            dispatch({ type: 'RESTORE_TOKEN', token: userToken, user_type: userType });
          }
        } else {
          dispatch({ type: 'SET_LOADING', isLoading: false });
        }
      } catch (error) {
        console.error('Error bootstrapping auth state:', error);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    };

    bootstrapAsync();
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

        const { token, user_id, user_type, expiresIn } = await response.json();
        
        // Calculate expiry time and store it
        const expiryTime = Date.now() + expiresIn * 1000;
        
        await SecureStore.setItemAsync('userToken', token);
        await SecureStore.setItemAsync('userId', user_id.toString());
        await SecureStore.setItemAsync('userType', user_type);
        await SecureStore.setItemAsync('tokenExpiry', expiryTime.toString());
        
        dispatch({ type: 'SIGN_IN', token, user_type });
        return token;
      } catch (error: any) {
        console.error('signIn error:', error);
        Alert.alert('Login Error', error.message);
        throw error;
      }
    },

    refreshToken: async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) return false;
        
        const response = await fetch('https://petlyst.com:3001/api/refresh-token', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) return false;
        
        const { token: newToken, expiresIn } = await response.json();
        const expiryTime = Date.now() + expiresIn * 1000;
        
        await SecureStore.setItemAsync('userToken', newToken);
        await SecureStore.setItemAsync('tokenExpiry', expiryTime.toString());
        
        const userType = await SecureStore.getItemAsync('userType');
        if (userType) {
          dispatch({ type: 'RESTORE_TOKEN', token: newToken, user_type: userType });
        }
        
        return true;
      } catch (error) {
        console.error('refreshToken error:', error);
        return false;
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
      } catch (error: any) {
        console.error('signUp error:', error);
        Alert.alert('Sign Up Error', error.message);
        throw error;
      }
    },

    signOut: async () => {
      try {
        // Get the current token to make authenticated request
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          try {
            // Call the API to delete Expo tokens
            await fetch('https://petlyst.com:3001/api/delete-expo-tokens', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
            // We don't need to check the response - even if it fails, we want to clear local storage
          } catch (e) {
            console.error('Failed to delete Expo tokens:', e);
            // Continue with sign out even if token deletion fails
          }
        }

        // Clear all local storage data
        await SecureStore.deleteItemAsync('userToken');
        await SecureStore.deleteItemAsync('userId');
        await SecureStore.deleteItemAsync('userType');
        await SecureStore.deleteItemAsync('tokenExpiry');
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
