import React, { Component, ErrorInfo, ReactNode } from 'react';
import { transform } from 'sucrase';
import * as LucideIcons from 'lucide-react';
import * as Motion from 'motion/react';
import { GAWContext, GAWPluginComponent } from '../types/plugin';

export interface CompilationResult {
  success: boolean;
  component?: GAWPluginComponent;
  error?: string;
}

export class PluginEngine {
  private static componentCache: Map<string, GAWPluginComponent> = new Map();

  /**
   * Compiles TSX code using Sucrase and binds React and icons.
   */
  public static compile(tsxCode: string, pluginId: string): CompilationResult {
    try {
      // 1. Transform TSX + TypeScript to standard ES/CJS JavaScript
      const transformed = transform(tsxCode, {
        transforms: ['typescript', 'jsx'],
        jsxRuntime: 'classic',
        production: true,
      });

      const jsCode = transformed.code;

      // 2. Wrap in sandbox module scope
      // The plugin exports default function or assigns module.exports = ...
      const exportsObj: any = {};
      const moduleObj: any = { exports: exportsObj };

      // Scope providers
      const scopeArgs = [
        'React',
        'useState',
        'useEffect',
        'useMemo',
        'useCallback',
        'useRef',
        'useContext',
        'useReducer',
        'LucideIcons',
        'Motion',
        'exports',
        'module',
      ];

      const scopeValues = [
        React,
        React.useState,
        React.useEffect,
        React.useMemo,
        React.useCallback,
        React.useRef,
        React.useContext,
        React.useReducer,
        LucideIcons,
        Motion,
        exportsObj,
        moduleObj,
      ];

      // Custom require polyfill inside plugin for Lucide icons or React
      const mockRequire = (mod: string) => {
        if (mod === 'react') return React;
        if (mod === 'lucide-react') return LucideIcons;
        if (mod === 'motion' || mod === 'motion/react' || mod === 'framer-motion') return Motion;
        throw new Error(`Module "${mod}" is not available in sandbox. Use globals or React / Lucide.`);
      };

      scopeArgs.push('require');
      scopeValues.push(mockRequire);

      // Execute code
      const factory = new Function(...scopeArgs, jsCode);
      factory(...scopeValues);

      const FinalComponent: any = moduleObj.exports?.default || moduleObj.exports || exportsObj.default;

      if (!FinalComponent || (typeof FinalComponent !== 'function' && typeof FinalComponent !== 'object')) {
        return {
          success: false,
          error: 'Plugin must export a default React component (e.g. export default function MyPlugin({ gaw }) { ... })',
        };
      }

      this.componentCache.set(pluginId, FinalComponent);
      return { success: true, component: FinalComponent };
    } catch (err: any) {
      console.error('Plugin compilation error:', err);
      return {
        success: false,
        error: err.message || String(err),
      };
    }
  }

  public static clearCache(pluginId?: string): void {
    if (pluginId) {
      this.componentCache.delete(pluginId);
    } else {
      this.componentCache.clear();
    }
  }
}

// --- Safe Mode Error Boundary Component ---
interface ErrorBoundaryProps {
  children: ReactNode;
  pluginName: string;
  onOpenInIDE?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PluginErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('Plugin Error Boundary Caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-900 text-slate-100">
          <div className="max-w-xl w-full bg-slate-950 border border-red-500/40 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <LucideIcons.AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h2 className="text-base font-bold text-white">
                Plugin Safe Mode: {this.props.pluginName}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              A runtime exception occurred inside this dynamic plugin. The GAW core engine and SQLite database have been safely isolated.
            </p>

            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 font-mono text-xs text-red-300 overflow-auto max-h-48 mb-4">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack && (
                <div className="mt-2 text-[10px] text-red-400/70 border-t border-red-900/40 pt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                Retry Plugin
              </button>
              {this.props.onOpenInIDE && (
                <button
                  onClick={this.props.onOpenInIDE}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow transition flex items-center gap-1.5"
                >
                  <LucideIcons.Code2 className="w-3.5 h-3.5" />
                  Edit & Debug in IDE
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
