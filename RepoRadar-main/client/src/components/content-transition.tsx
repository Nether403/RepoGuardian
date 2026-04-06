import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContentTransitionProps {
  children: React.ReactNode;
  isLoading: boolean;
  skeleton: React.ReactNode;
  className?: string;
}

/**
 * ContentTransition component provides smooth transitions between loading skeleton and actual content
 * Uses framer-motion for smooth fade and scale animations
 */
export const ContentTransition: React.FC<ContentTransitionProps> = ({
  children,
  isLoading,
  skeleton,
  className = '',
}) => {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
