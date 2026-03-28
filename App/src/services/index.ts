/**
 * Enhanced Services & Components Export
 * Centralized exports for all new improvements
 */

// Services
export { AIBackendService } from './AIBackendService';
export type { StreamingOptions } from './AIBackendService';

export { ConversationContextManager } from './ConversationContextManager';
export type { 
  ConversationContext,
  ContextSnapshot
} from './ConversationContextManager';

export { PerformanceOptimizer } from './PerformanceOptimizer';
export type { 
  PerformanceMetric,
  PerformanceThresholds
} from './PerformanceOptimizer';

// Components are exported from respective files
// import Breadcrumb from '../components/Breadcrumb';
// import WindowControls from '../components/WindowControls';
