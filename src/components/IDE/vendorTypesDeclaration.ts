export const REACT_TYPES_DECLARATION = `
declare namespace React {
  export type ReactNode = any;
  export type ReactElement<P = any, T = any> = any;
  export type ComponentType<P = any> = any;
  export type FC<P = any> = (props: P) => any;
  export type Key = string | number;
  export type Ref<T = any> = any;
  export type CSSProperties = Record<string, any>;
  export type MouseEvent<T = any> = any;
  export type ChangeEvent<T = any> = any;
  export type FormEvent<T = any> = any;
  export type KeyboardEvent<T = any> = any;
  export type ReactEventHandler<T = any> = (event: any) => void;

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue?: T): { current: T };
  export function useContext<T>(context: any): T;
  export function useReducer<R extends (...args: any[]) => any>(reducer: R, initialArg: any, init?: any): any;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export const Fragment: any;
}

declare module 'react' {
  export = React;
  export as namespace React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element {
      [key: string]: any;
    }
  }
}
`;

export const LUCIDE_TYPES_DECLARATION = `
declare module 'lucide-react' {
  import * as React from 'react';

  export interface LucideProps {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    className?: string;
    style?: any;
    onClick?: (e?: any) => void;
    [key: string]: any;
  }

  export type LucideIcon = React.FC<LucideProps>;

  // Standard Lucide icons
  export const Play: LucideIcon;
  export const Pause: LucideIcon;
  export const Plus: LucideIcon;
  export const Trash2: LucideIcon;
  export const Trash: LucideIcon;
  export const Edit: LucideIcon;
  export const Edit2: LucideIcon;
  export const Edit3: LucideIcon;
  export const Save: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Folder: LucideIcon;
  export const FolderOpen: LucideIcon;
  export const File: LucideIcon;
  export const FileCode: LucideIcon;
  export const FileText: LucideIcon;
  export const Database: LucideIcon;
  export const Search: LucideIcon;
  export const Settings: LucideIcon;
  export const Check: LucideIcon;
  export const X: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Info: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const Layers: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Cloud: LucideIcon;
  export const Clock: LucideIcon;
  export const ArrowDownLeft: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const Filter: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Copy: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const XCircle: LucideIcon;
  export const Table: LucideIcon;
  export const BarChart: LucideIcon;
  export const BarChart2: LucideIcon;
  export const BarChart3: LucideIcon;
  export const PieChart: LucideIcon;
  export const LineChart: LucideIcon;
  export const Code2: LucideIcon;
  export const Code: LucideIcon;
  export const Terminal: LucideIcon;
  export const Layout: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const LayoutGrid: LucideIcon;
  export const Users: LucideIcon;
  export const User: LucideIcon;
  export const Package: LucideIcon;
  export const ShoppingCart: LucideIcon;
  export const Sun: LucideIcon;
  export const Moon: LucideIcon;
  export const Undo: LucideIcon;
  export const Redo: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const Globe: LucideIcon;
  export const Lock: LucideIcon;
  export const Unlock: LucideIcon;
  export const Key: LucideIcon;
  export const Zap: LucideIcon;
  export const Activity: LucideIcon;
  export const Box: LucideIcon;
  export const Boxes: LucideIcon;
  export const Shield: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Star: LucideIcon;
  export const Heart: LucideIcon;
  export const Bell: LucideIcon;
  export const Mail: LucideIcon;
  export const Link: LucideIcon;
  export const List: LucideIcon;
  export const Grid: LucideIcon;
  export const Columns: LucideIcon;
  export const Rows: LucideIcon;
  export const Share2: LucideIcon;
  export const Wrench: LucideIcon;
  export const Sliders: LucideIcon;
  export const Maximize2: LucideIcon;
  export const Minimize2: LucideIcon;
  export const ZoomIn: LucideIcon;
  export const ZoomOut: LucideIcon;
  export const Move: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const ArrowUpDown: LucideIcon;
  export const Calendar: LucideIcon;
  export const Compass: LucideIcon;
  export const Cpu: LucideIcon;
  export const HardDrive: LucideIcon;
  export const Server: LucideIcon;
  export const TerminalSquare: LucideIcon;
  export const LogOut: LucideIcon;
  export const LogIn: LucideIcon;
  export const Wifi: LucideIcon;
  export const WifiOff: LucideIcon;
  export const PanelLeft: LucideIcon;

  // Wildcard icons fallback
  const icon: LucideIcon;
  export default icon;
  export = icon;
}
`;
