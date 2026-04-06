import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

export const useWebSocket = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null
  });
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected || !user) return;

    setState(prev => ({ ...prev, connecting: true, error: null }));

    const socket = io(window.location.origin, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setState(prev => ({ ...prev, connected: true, connecting: false }));
      
      // Authenticate with user ID
      socket.emit('authenticate', user.id);
    });

    socket.on('authenticated', (data) => {
      console.log('WebSocket authenticated:', data);
      toast({
        title: 'Connected',
        description: 'Real-time updates enabled',
        duration: 2000
      });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setState(prev => ({ ...prev, connected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setState(prev => ({ 
        ...prev, 
        connected: false, 
        connecting: false,
        error: error.message 
      }));
    });

    // Analysis progress updates
    socket.on('analysis_progress', (data) => {
      const notification: NotificationData = {
        id: `analysis_${data.analysisId}_${Date.now()}`,
        type: 'analysis_progress',
        title: 'Analysis Progress',
        message: `${data.stage}: ${data.message} (${data.percentage}%)`,
        timestamp: data.timestamp,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
    });

    // Repository updates
    socket.on('repository_update', (data) => {
      const notification: NotificationData = {
        id: `repo_${data.repositoryId}_${Date.now()}`,
        type: 'repository_update',
        title: 'Repository Update',
        message: `${data.type} changed from ${data.oldValue} to ${data.newValue}`,
        timestamp: data.timestamp,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      toast({
        title: 'Repository Updated',
        description: notification.message,
        duration: 3000
      });
    });

    // New analysis completion
    socket.on('new_analysis', (data) => {
      const notification: NotificationData = {
        id: `new_analysis_${Date.now()}`,
        type: 'new_analysis',
        title: 'Analysis Complete',
        message: `Analysis for ${data.analysis.repositoryName} is ready`,
        timestamp: data.timestamp,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      toast({
        title: 'Analysis Complete',
        description: notification.message,
        duration: 5000
      });
    });

    // Collaboration updates
    socket.on('collaboration_update', (data) => {
      const notification: NotificationData = {
        id: `collab_${Date.now()}`,
        type: 'collaboration',
        title: 'Collaboration Update',
        message: `New ${data.type} activity`,
        timestamp: data.timestamp,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      if (data.type !== 'view') {
        toast({
          title: 'Team Activity',
          description: notification.message,
          duration: 4000
        });
      }
    });

    // System alerts
    socket.on('system_alert', (data) => {
      const notification: NotificationData = {
        id: `system_${Date.now()}`,
        type: 'system',
        title: 'System Alert',
        message: data.message,
        timestamp: data.timestamp,
        data
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      toast({
        title: `System ${data.severity.toUpperCase()}`,
        description: data.message,
        variant: data.severity === 'error' ? 'destructive' : 'default',
        duration: data.severity === 'error' ? 8000 : 5000
      });
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    socket.on('pong', () => {
      console.log('WebSocket heartbeat received');
    });

    return () => {
      clearInterval(heartbeat);
    };
  }, [user, toast]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState({ connected: false, connecting: false, error: null });
    }
  }, []);

  const trackRepository = useCallback((repositoryId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('track_repository', repositoryId);
    }
  }, []);

  const untrackRepository = useCallback((repositoryId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('untrack_repository', repositoryId);
    }
  }, []);

  const trackAnalysis = useCallback((analysisId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('track_analysis', analysisId);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Auto-connect when user is available
  useEffect(() => {
    if (user && !state.connected && !state.connecting) {
      connect();
    }

    return () => {
      if (!user) {
        disconnect();
      }
    };
  }, [user, state.connected, state.connecting, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    notifications,
    connect,
    disconnect,
    trackRepository,
    untrackRepository,
    trackAnalysis,
    clearNotifications,
    clearNotification
  };
};