import { createContext, useContext } from 'react';
import type { ID } from '../model/types';
import type { VisualStyle } from '../kit/types';

export interface FlowViewContextValue {
  style: VisualStyle;
  onPlayVariant?: (variantId: ID) => void;
}

export const FlowViewContext = createContext<FlowViewContextValue>({ style: 'sketchy' });
export const useFlowView = () => useContext(FlowViewContext);
