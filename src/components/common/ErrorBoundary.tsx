import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Music } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetSession = () => {
    try {
      localStorage.removeItem('BEATPULSE_ACTIVE_SESSION');
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handlePurgeCache = () => {
    try {
      localStorage.removeItem('BEATPULSE_ACTIVE_SESSION');
      localStorage.removeItem('BEATPULSE_LOCAL_METADATA_SNAPSHOT_V1');
      localStorage.removeItem('BEATPULSE_GAME_SETTINGS_V1');
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 sm:p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Terjadi Kesalahan Aplikasi
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Aplikasi mengalami kendala tak terduga. Sesi Anda dapat dipulihkan dengan aman tanpa kehilangan data tersimpan.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl text-left overflow-hidden">
                <p className="text-[11px] font-mono text-rose-300 font-semibold break-words">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400 font-medium">
                      Detail Stack Trace
                    </summary>
                    <pre className="mt-1 text-[9px] text-slate-500 font-mono overflow-x-auto max-h-32 p-1 bg-slate-900/50 rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleResetSession}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>Pulihkan Sesi</span>
              </button>
              <button
                onClick={this.handlePurgeCache}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Bersihkan Cache & Reset</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
